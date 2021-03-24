import Head from 'next/head'
import { useRouter } from 'next/router'

export default ({ ...customMeta }) => {
  // const {...customMeta}=props
  const router = useRouter()

  const meta = {
    name: "Aksar La'ode",
    title: 'Aksar La’ode – Developer, writer, creator.',
    description: `Front-end developer, JavaScript enthusiast, and course creator.`,
    image: 'https://aksarlaode.vercel.app/static/images/banner.png',
    type: 'website',
    ...customMeta
  }
  return (
    <Head>
      <title>{meta.title}</title>
      <meta name="robots" content="follow, index" />
      <meta name="description" content={meta.description} />
      <meta
        property="og:url"
        content={`https://aksarlaode.vercel.app${router.asPath}`}
      />
      <link
        rel="canonical"
        href={`https://aksarlaode.vercel.app${router.asPath}`}
      />
      <meta property="og:type" content={meta.type} />
      <meta property="og:site_name" content="Aksar La'ode" />
      <meta property="og:description" content={meta.description} />
      <meta property="og:title" content={meta.title} />
      <meta property="og:image" content={meta.image} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@ode_aksar" />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
      <meta name="twitter:image" content={meta.image} />
      {meta.date && (
        <meta property="article:published_time" content={meta.date} />
      )}
    </Head>
  )
}
