import { describe, it, expect, beforeEach } from 'vitest'

import { PlaylistQueue } from '../../app/utils/playlist-queue'
import { PLAYLIST_MAX_TRACKS } from '../../app/constants/room'
import type { Track } from '../../app/types/room/audio-player'

/** Build an `audio/*` File handle the way the uploader would hand it over. */
function audioFile(name: string): File {
  return new File([new Uint8Array([0, 1, 2])], name, { type: 'audio/mpeg' })
}

function titles(queue: PlaylistQueue): string[] {
  return queue.tracks.map((t) => t.title)
}

describe('PlaylistQueue', () => {
  let queue: PlaylistQueue

  beforeEach(() => {
    queue = new PlaylistQueue()
  })

  describe('add', () => {
    it('appends a single file and returns the created track', () => {
      const [track] = queue.add(audioFile('first.mp3'))

      expect(track?.title).toBe('first')
      expect(track?.file.name).toBe('first.mp3')
      expect(queue.tracks).toHaveLength(1)
      expect(queue.current).toBe(track)
    })

    it('appends multiple files in order and returns them in order', () => {
      const created = queue.add([audioFile('a.mp3'), audioFile('b.wav'), audioFile('c.ogg')])

      expect(created.map((t) => t.title)).toEqual(['a', 'b', 'c'])
      expect(titles(queue)).toEqual(['a', 'b', 'c'])
    })

    it('extends an existing queue without disturbing the current track', () => {
      queue.add([audioFile('a.mp3'), audioFile('b.mp3')])
      const current = queue.current

      queue.add(audioFile('c.mp3'))

      expect(titles(queue)).toEqual(['a', 'b', 'c'])
      expect(queue.current).toBe(current)
    })

    it('gives each track a stable unique id and holds no decoded PCM', () => {
      const created = queue.add([audioFile('a.mp3'), audioFile('b.mp3')])
      const ids = created.map((t) => t.id)

      expect(new Set(ids).size).toBe(ids.length)
      created.forEach((track) => {
        expect(track.duration).toBeNull()
        expect(track.file).toBeInstanceOf(File)
        // No AudioBuffer / PCM fields leak into the queue model.
        expect(Object.keys(track).sort()).toEqual(['duration', 'file', 'id', 'title'])
      })
    })

    it('derives the title from the filename by stripping the extension', () => {
      const [a] = queue.add(audioFile('My Song.final.mp3'))
      const [b] = queue.add(audioFile('NoExtension'))

      expect(a?.title).toBe('My Song.final')
      expect(b?.title).toBe('NoExtension')
    })
  })

  describe('remove', () => {
    it('drops a non-current track and preserves the order of the rest', () => {
      queue.add([audioFile('a.mp3'), audioFile('b.mp3'), audioFile('c.mp3')])

      queue.remove(queue.tracks[1]!.id)

      expect(titles(queue)).toEqual(['a', 'c'])
      expect(queue.current!.title).toBe('a')
    })

    it('keeps the same track current when removing one before it', () => {
      queue.add([audioFile('a.mp3'), audioFile('b.mp3'), audioFile('c.mp3')])
      queue.next() // current → b

      queue.remove(queue.tracks[0]!.id) // remove a

      expect(titles(queue)).toEqual(['b', 'c'])
      expect(queue.current!.title).toBe('b')
    })

    it('advances current to the next track when removing the current one (skip semantics)', () => {
      queue.add([audioFile('a.mp3'), audioFile('b.mp3'), audioFile('c.mp3')])

      queue.remove(queue.current!.id) // remove a (current)

      expect(titles(queue)).toEqual(['b', 'c'])
      expect(queue.current!.title).toBe('b')
    })

    it('falls back to the new last track when removing the current-and-last track', () => {
      queue.add([audioFile('a.mp3'), audioFile('b.mp3')])
      queue.next() // current → b (last)

      queue.remove(queue.current!.id) // remove b

      expect(titles(queue)).toEqual(['a'])
      expect(queue.current!.title).toBe('a')
      expect(queue.hasNext).toBe(false)
    })

    it('leaves a well-defined empty queue when removing the only track', () => {
      queue.add(audioFile('only.mp3'))

      queue.remove(queue.current!.id)

      expect(queue.tracks).toHaveLength(0)
      expect(queue.current).toBeNull()
      expect(queue.hasNext).toBe(false)
    })

    it('ignores an unknown id', () => {
      queue.add([audioFile('a.mp3'), audioFile('b.mp3')])

      queue.remove('does-not-exist')

      expect(titles(queue)).toEqual(['a', 'b'])
    })
  })

  describe('reorder', () => {
    it('moves a track and preserves the relative order of the others', () => {
      queue.add([audioFile('a.mp3'), audioFile('b.mp3'), audioFile('c.mp3'), audioFile('d.mp3')])

      queue.reorder(0, 2) // move a between c and d

      expect(titles(queue)).toEqual(['b', 'c', 'a', 'd'])
    })

    it('keeps the same track current across a reorder', () => {
      queue.add([audioFile('a.mp3'), audioFile('b.mp3'), audioFile('c.mp3')])
      queue.next() // current → b

      queue.reorder(1, 0) // move b to the front

      expect(titles(queue)).toEqual(['b', 'a', 'c'])
      expect(queue.current!.title).toBe('b')
      expect(queue.hasNext).toBe(true)
    })

    it('ignores out-of-range and no-op moves', () => {
      queue.add([audioFile('a.mp3'), audioFile('b.mp3')])

      queue.reorder(0, 0)
      queue.reorder(-1, 1)
      queue.reorder(0, 5)

      expect(titles(queue)).toEqual(['a', 'b'])
    })
  })

  describe('next / prev traversal', () => {
    it('traverses forward and returns null at the end without moving current', () => {
      queue.add([audioFile('a.mp3'), audioFile('b.mp3')])

      expect(queue.next()!.title).toBe('b')
      expect(queue.hasNext).toBe(false)
      expect(queue.next()).toBeNull()
      expect(queue.current!.title).toBe('b')
    })

    it('restarts the current track when prev is called at the start', () => {
      queue.add([audioFile('a.mp3'), audioFile('b.mp3')])

      const restarted = queue.prev()

      expect(restarted!.title).toBe('a')
      expect(queue.current!.title).toBe('a')
    })

    it('steps backward to the previous track', () => {
      queue.add([audioFile('a.mp3'), audioFile('b.mp3'), audioFile('c.mp3')])
      queue.next()
      queue.next() // current → c

      expect(queue.prev()!.title).toBe('b')
      expect(queue.prev()!.title).toBe('a')
      expect(queue.prev()!.title).toBe('a') // restart at start
    })

    it('keeps current and hasNext correct through a full play-through', () => {
      queue.add([audioFile('a.mp3'), audioFile('b.mp3'), audioFile('c.mp3')])

      expect(queue.current!.title).toBe('a')
      expect(queue.hasNext).toBe(true)

      expect(queue.next()!.title).toBe('b')
      expect(queue.hasNext).toBe(true)

      expect(queue.next()!.title).toBe('c')
      expect(queue.hasNext).toBe(false)

      expect(queue.next()).toBeNull()
      expect(queue.current!.title).toBe('c')
    })
  })

  describe('empty-queue behaviour', () => {
    it('is safe and well-defined with no tracks', () => {
      expect(queue.current).toBeNull()
      expect(queue.hasNext).toBe(false)
      expect(queue.tracks).toEqual([])
      expect(queue.next()).toBeNull()
      expect(queue.prev()).toBeNull()
      expect(() => queue.remove('x')).not.toThrow()
      expect(() => queue.reorder(0, 1)).not.toThrow()
    })
  })

  describe('queue-length cap', () => {
    it('enforces the cap, ignoring files beyond the limit', () => {
      const many = Array.from({ length: PLAYLIST_MAX_TRACKS + 10 }, (_, i) => audioFile(`t${i}.mp3`))

      const created = queue.add(many)

      expect(queue.tracks).toHaveLength(PLAYLIST_MAX_TRACKS)
      expect(created).toHaveLength(PLAYLIST_MAX_TRACKS)
    })

    it('ignores adds once the queue is already full', () => {
      queue.add(Array.from({ length: PLAYLIST_MAX_TRACKS }, (_, i) => audioFile(`t${i}.mp3`)))

      const overflow = queue.add(audioFile('one-too-many.mp3'))

      expect(overflow).toEqual([])
      expect(queue.tracks).toHaveLength(PLAYLIST_MAX_TRACKS)
    })
  })

  it('exposes only readonly snapshots — mutating the returned array does not affect the queue', () => {
    queue.add([audioFile('a.mp3'), audioFile('b.mp3')])

    const snapshot = queue.tracks as Track[]
    snapshot.push(audioFile('hacked.mp3') as unknown as Track)

    expect(queue.tracks).toHaveLength(2)
  })
})
