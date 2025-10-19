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
            compoundVariants: [
                {
                    color: 'primary',
                    variant: 'solid',
                    class: 'text-white'
                },
                {
                    color: 'primary',
                    variant: 'outline',
                    class: 'text-white'
                },
                {
                    color: 'primary',
                    variant: 'soft',
                    class: 'text-white'
                },
                {
                    color: 'primary',
                    variant: 'subtle',
                    class: 'text-white'
                },
                {
                    color: 'primary',
                    variant: 'ghost',
                    class: 'text-white'
                },
                {
                    color: 'primary',
                    variant: 'link',
                    class: 'text-white'
                }
            ]
        }
    }
})