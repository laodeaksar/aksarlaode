// import ConsCard from '@/components/ConsCard'
// import Analytics from '@/components/metrics/Analytics'
// import Gumroad from '@/components/metrics/Gumroad'
// import Unsplash from '@/components/metrics/Unsplash'
// import YouTube from '@/components/metrics/Youtube'
// import ProsCard from '@/components/ProsCard'
// import Step from '@/components/Step'
import {
  Alert,
  Box,
  // Code,
  Divider,
  Heading,
  // Kbd,
  Link,
  Text,
  ColorMode
} from 'theme-ui'
import Image from 'next/image'
import NextLink from 'next/link'
// import Tweet from 'react-tweet-embed'

// const Table = (props) => (
//   <Box overflowX="scroll" w="full" my={2}>
//     <Box as="table" align="left" mt={6} w="full" {...props} />
//   </Box>
// )

// const THead = (props) => {
//   return (
//     <Box
//       as="th"
//       bg={useColorModeValue('gray.50', 'whiteAlpha.100')}
//       fontWeight="semibold"
//       p={2}
//       fontSize="sm"
//       {...props}
//     />
//   )
// }

// const TData = (props) => {
//   return (
//     <Box
//       as="td"
//       borderTopWidth="1px"
//       borderColor="inherit"
//       whiteSpace="normal"
//       fontSize="sm"
//       p={2}
//       {...props}
//     />
//   )
// }

const CustomLink = props => {
  const href = props.href
  const isInternalLink = href && (href.startsWith('/') || href.startsWith('#'))

  if (isInternalLink) {
    return (
      <NextLink href={href} passHref>
        <Link {...props} />
      </NextLink>
    )
  }

  return <Link isExternal {...props} />
}

const Quote = props => {
  return (
    <Alert
      my={2}
      role="none"
      variant="left-accent"
      status="info"
      css={{
        '> *:first-of-type': {
          marginTop: 0,
          marginLeft: 8
        }
      }}
      {...props}
    />
  )
}

const DocsHeading = props => (
  <Heading
    css={{
      scrollMarginTop: '100px',
      scrollSnapMargin: '100px', // Safari
      '&[id]': {
        pointerEvents: 'none'
      },
      '&[id]:before': {
        display: 'block',
        height: ' 6rem',
        marginTop: '-6rem',
        visibility: 'hidden',
        content: `""`
      },
      '&[id]:hover a': { opacity: 1 }
    }}
    {...props}
    my={2}
  >
    <Box pointerEvents="auto">
      {props.children}
      {props.id && (
        <Box
          as="a"
          aria-label="anchor"
          fontWeight="bold"
          outline="none"
          _focus={{
            opacity: 1,
            boxShadow: 'none'
          }}
          opacity={0}
          ml="0.375rem"
          href={`#${props.id}`}
        >
          #
        </Box>
      )}
    </Box>
  </Heading>
)

const Hr = () => {
  return <Divider my={4} w="full" />
}

const MDXComponents = {
  h1: props => <Heading as="h1" size="xl" my={4} {...props} />,
  h2: props => <DocsHeading as="h2" size="lg" fontWeight="bold" {...props} />,
  h3: props => <DocsHeading as="h3" size="md" fontWeight="bold" {...props} />,
  h3: props => <DocsHeading as="h4" size="sm" fontWeight="bold" {...props} />,
  //   inlineCode: (props) => <Code fontSize="0.84em" {...props} />,
  //   kbd: Kbd,
  br: props => <Box height="24px" {...props} />,
  hr: Hr,
  //   table: Table,
  //   th: THead,
  //   td: TData,
  a: CustomLink,
  p: props => <Text as="p" mt={0} lineHeight="tall" {...props} />,
  ul: props => <Box as="ul" pt={2} pl={4} ml={2} {...props} />,
  ol: props => <Box as="ol" pt={2} pl={4} ml={2} {...props} />,
  li: props => <Box as="li" pb={1} {...props} />,
  blockquote: Quote,
  Image
  //   Analytics,
  //   ConsCard,
  //   Gumroad,
  //   ProsCard,
  //   Step,
  //   Tweet,
  //   Unsplash,
  //   YouTube,
}

export { CustomLink }
export default MDXComponents
