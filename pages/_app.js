import ColorSwitcher from '@/components/color-switcher'
import theme from '@hackclub/theme'
import '@hackclub/theme/fonts/reg-bold.css'
import { ThemeProvider } from 'theme-ui'

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider theme={theme}>
      <ColorSwitcher />
      <Component {...pageProps} />
    </ThemeProvider>
  )
}
