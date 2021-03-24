import { Component } from 'react'
import NProgress from 'nprogress'
import Router from 'next/router'

class NProgressContainer extends Component {
  static defaultProps = {
    color: '#ec3750',
    showAfterMs: 300,
    spinner: false
  }

  timer = null

  routeChangeStart = () => {
    const { showAfterMs } = this.props
    clearTimeout(this.timer)
    this.timer = setTimeout(NProgress.start, showAfterMs)
  }
  routeChangeEnd = () => {
    clearTimeout(this.timer)
    NProgress.done()
  }

  componentDidMount() {
    const { options } = this.props

    if (options) {
      NProgress.configure(options)
    }

    Router.events.on('routeChangeStart', this.routeChangeStart)
    Router.events.on('routeChangeEnd', this.routeChangeEnd)
    Router.events.on('routeChangeError', this.routeChangeEnd)
  }

  componentWillUnmount() {
    clearTimeout(this.timer)
    Router.events.on('routeChangeStart', this.routeChangeStart)
    Router.events.on('routeChangeEnd', this.routeChangeEnd)
    Router.events.on('routeChangeError', this.routeChangeEnd)
  }

  render() {
    const { color, spinner } = this.props

    return (
      <style jsx global>{`
        #nprogress {
          pointer-events: none;
        }
        #nprogress .bar {
          background: var(--color-progress);
          position: fixed;
          z-index: 1031;
          top: 0;
          left: 0;
          width: 100%;
          height: 2px;
        }
        #nprogress .peg {
          display: block;
          position: absolute;
          right: 0;
          width: 100px;
          height: 100%;
          box-shadow: 0 0 10px var(--color-progress),
            0 0 5px var(--color-progress);
          opacity: 1;
          -webkit-transform: rotate(3deg) translate(0px, -4px);
          -ms-transform: rotate(3deg) translate(0px, -4px);
          transform: rotate(3deg) translate(0px, -4px);
        }
        #nprogress .spinner {
          display: none;
          position: fixed;
          z-index: 1031;
          top: 15px;
          right: 15px;
        }
        #nprogress .spinner-icon {
          display: none;
          width: 18px;
          height: 18px;
          box-sizing: border-box;
          border-top-color: ${color};
          border-left-color: ${color};
          border-radius: 50%;
          -webkit-animation: nprogress-spinner 400ms linear infinite;
          animation: nprogress-spinner 400ms linear infinite;
        }
        .nprogress-custom-parent {
          overflow: hidden;
          position: relative;
        }
        .nprogress-custom-parent #nprogress .spinner,
        .nprogress-custom-parent #nprogress .bar {
          position: absolute;
        }
        @-webkit-keyframes nprogress-spinner {
          0% {
            -webkit-transform: rotate(0deg);
          }
          100% {
            -webkit-transform: rotate(360deg);
          }
        }
        @keyframes nprogress-spinner {
          0% {
            -webkit-transform: rotate(0deg);
          }
          100% {
            -webkit-transform: rotate(360deg);
          }
        }
      `}</style>
    )
  }
}

export default NProgressContainer
