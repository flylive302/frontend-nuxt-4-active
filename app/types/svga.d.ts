declare module 'svga/dist/index.esm.min.js' {
  export class Player {
    constructor(canvas: HTMLCanvasElement)
    mount(parser: Parser): void
    start(): void
  }
  export class Parser {
    load(url: string): Promise<unknown>
  }
}
