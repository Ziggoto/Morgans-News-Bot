const fetch = require('node-fetch')
const jsdom = require('jsdom')
const config = require('dotenv').config()

const { JSDOM } = jsdom

const selectors = {
  postContent: 'div[data-test-id="post-content"]'
}

const formatUrl = (route) => `https://www.reddit.com${route}`

const fetchPost = () => {
  console.log('Fetching /r/OnePiece')
  return fetch('https://www.reddit.com/r/OnePiece/')
    .then(response => response.text())
}

const fetchMangaUrl = (postUrl) => {
  console.log(`Fetching ${postUrl}`)
  return fetch(postUrl)
    .then(response => response.text())
}

const sendMessageOnTelegram = (url) => {
  const { ACCESS_TOKEN } = process.env
  console.log('Sending message to Telegram')

  fetch(`https://api.telegram.org/bot${ACCESS_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      'chat_id': 59761682,
      text: `Mangá anunciado! ${url}`
    })
  })
}

const parsePostList = (htmlDocument) => {
  return new Promise((resolve, reject) => {
    const { document } = new JSDOM(htmlDocument).window

    const headers = [...document.querySelectorAll('span')]
      .filter(el => el.textContent.match(/Current Chapter/))
      .map(el => el.parentElement.href)
      .map(formatUrl)

    if (headers.length > 0) {
      console.log('Found: ', headers[0])
      resolve(headers[0])
    }
    console.error('Not found any manga, aborting...')
    reject()
  })
}

const parseMangaPost = (htmlDocument) => {
  return new Promise((resolve, reject) => {
    const { document } = new JSDOM(htmlDocument).window
    const urls = [...document.querySelector(selectors.postContent).querySelectorAll('a')]
      .map(a => a.href)
      .filter(el => !el.match(/redit/g))

    if (urls.length > 0) {
      console.log('Found: ', urls[0])
      resolve(urls[0])
    }
    console.error('Not found any url link, aborting...')
    reject()
  })
}

const main = () => {
  fetchPost()
    .then(parsePostList)
    .then(fetchMangaUrl)
    .then(parseMangaPost)
    .then(sendMessageOnTelegram)
    .catch(err => console.err)
}

main()
