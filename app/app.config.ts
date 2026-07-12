const accentButtonColors = ['primary', 'secondary', 'tertiary'] as const
const buttonVariants = ['solid', 'outline', 'soft', 'subtle', 'ghost', 'link'] as const

const compoundButtonVariants = accentButtonColors.flatMap(color =>
    buttonVariants.map(variant => ({
        color,
        variant,
        class: color === 'primary' && variant === 'solid'
            ? 'text-primary-50'
            : 'text-primary-50'
    }))
)

export default defineAppConfig({
    ui: {
        colors: {
            primary: 'pink',
            secondary: 'purple',
            tertiary: 'amber',
            info: 'sky',
            success: 'emerald',
            warning: 'yellow',
            error: 'red',
            neutral: 'neutral'
        },
        button: {
            compoundVariants: compoundButtonVariants
        },
        drawer: {
            // Safe-area padding lives on `content` (not `container`): drawers that
            // override the #content slot bypass the container div entirely, so
            // classes there silently vanish. `content` classes always apply.
            slots: {
                content: 'bg-neutral-950'
            },
            compoundVariants: [
                {
                    direction: [
                        'right',
                        'left'
                    ],
                    class: {
                        content: 'min-w-[96%] safe-area-top safe-area-bottom',
                    }
                },
                {
                    direction: 'bottom',
                    class: {
                        content: 'safe-area-bottom',
                    }
                },
                {
                    direction: 'top',
                    class: {
                        content: 'safe-area-top',
                    }
                }
            ]
        },
        slideover: {
            compoundVariants: [
                {
                    side: [
                        'right',
                        'left'
                    ],
                    class: {
                        content: 'safe-area-top safe-area-bottom',
                    }
                },
                {
                    side: 'bottom',
                    class: {
                        content: 'safe-area-bottom',
                    }
                },
                {
                    side: 'top',
                    class: {
                        content: 'safe-area-top',
                    }
                }
            ]
        }
    }
})
