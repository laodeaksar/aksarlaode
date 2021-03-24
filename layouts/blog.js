import { useEffect, useState } from 'react'
// import Container from '@/components/Container'
// import Subscribe from '@/components/Subscribe'
// import ViewCounter from '@/components/ViewCounter'
import {
  Avatar,
  Box,
  Flex,
  Heading,
  Icon,
  Link,
  Text,
  useColorModeValue
} from '@chakra-ui/react'
import { format, parseISO } from 'date-fns'
import LikeCounter from '@/components/LikeCounter'
import Comments from '@/components/Comments'
import { FiGithub, FiTwitter } from 'react-icons/fi'

const editUrl = slug =>
  `https://github.com/laodeaksar/laodeaksar.github.io/edit/master/data/blog/${slug}.mdx`
const tweetUrl = slug =>
  `https://twitter.com/intent/tweet?text=https://laodeaksar.vercel.app/blog/${slug} by @ode_aksar`

export default function BlogLayout({ children, frontMatter }) {
  const [width, setWidth] = useState(1)
  const handleScroll = () => {
    let scrollTop = window.scrollY
    let docHeight = document.body.offsetHeight
    let winHeight = window.innerHeight
    let scrollPercent = scrollTop / (docHeight - winHeight)
    let scrollPercentRounded = Math.round(scrollPercent * 100)
    setWidth(scrollPercentRounded)
    // console.log(scrollPercentRounded)
  }

  useEffect(() => {
    window.addEventListener('scroll', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  })

  return (
    <>
      <Box
        h={1}
        as="div"
        bgGradient="linear(to-r, green.200, pink.500)"
        position="sticky"
        top={0}
        zIndex={100}
        w={`${width}%`}
      />
      <Container
        title={`${frontMatter.title} - Aksar La’ode`}
        description={frontMatter.summary}
        image={`https://laodeaksar.github.io${frontMatter.image}`}
        date={new Date(frontMatter.publishedAt).toISOString()}
        type="article"
      >
        <Flex direction="column" justify="flex-start" align="flex-start">
          <Heading as="h2" mb={4} size="xl" letterSpacing="tight">
            {frontMatter.title}
          </Heading>
          <Flex
            direction={['column', 'row']}
            justify="space-between"
            align={['initial', 'center']}
            mt={2}
            w="full"
            mb={4}
          >
            <Flex align="center">
              <Avatar size="xs" name="Aksar La'ode" src="/avatar.jpg" mr={2} />
              <Text
                fontSize="sm"
                color={useColorModeValue('gray.700', 'gray.400')}
              >
                {frontMatter.by}
                {"Aksar La'ode / "}
                {format(parseISO(frontMatter.publishedAt), 'MMMM dd, yyyy')}
              </Text>
            </Flex>
            <Flex
              alignItems="center"
              fontSize="sm"
              color="gray.500"
              minW="100px"
              mt={[2, 0]}
            >
              {frontMatter.readingTime.text}
              <Text mx={1}>•</Text>
              <ViewCounter slug={frontMatter.slug} />
              <Text mx={1}>•</Text>
              <LikeCounter slug={frontMatter.slug} />
            </Flex>
          </Flex>
          {children}
          <Box my={2} alignItems="center">
            <Link
              color="gray.500"
              href={tweetUrl(frontMatter.slug)}
              isExternal
              _focus={{ boxShadow: 'none' }}
            >
              <Icon as={FiTwitter} size="18px" mr={2} />
              {'Share on Twitter'}
            </Link>
            {` • `}
            <Link
              color="gray.500"
              href={editUrl(frontMatter.slug)}
              isExternal
              _focus={{ boxShadow: 'none' }}
            >
              <Icon as={FiGithub} size="18px" mr={2} />
              {'Edit on GitHub'}
            </Link>
          </Box>
          <Subscribe />
          <Comments />
        </Flex>
      </Container>
    </>
  )
}
