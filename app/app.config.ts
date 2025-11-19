const accentButtonColors = ['primary', 'secondary', 'tertiary'] as const
const buttonVariants = ['solid', 'outline', 'soft', 'subtle', 'ghost', 'link'] as const

const compoundButtonVariants = accentButtonColors.flatMap(color =>
    buttonVariants.map(variant => ({
        color,
        variant,
        class: color === 'primary' && variant === 'solid'
            ? 'text-white border border-white/40 shadow-lg shadow-primary/50'
            : 'text-white'
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
            slots: {
                content: 'bg-neutral-950'
            }
        }
    }
})
