import ColorSwitcher from '@/components/color-switcher'
import NProgress from '@/components/nprogress'
import theme from '@/styles/theme'
import '@hackclub/theme/fonts/reg-bold.css'
import { ThemeProvider } from 'theme-ui'

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider theme={theme}>
      <ColorSwitcher />
      <NProgress color={'#ec3750'} />
      <Component {...pageProps} />
    </ThemeProvider>
  )
}
