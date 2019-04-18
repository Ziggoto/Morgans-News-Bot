const fetch = require('node-fetch')
const jsdom = require('jsdom')
const Cloudant = require ('@cloudant/cloudant')

const { JSDOM } = jsdom

/* -----------------------------
 *  Utils part
 * -----------------------------
*/
const getDayOfWeek = () => {
  const day = new Date();
  const MILLISECONDS_IN_WEEK = 604800000;
  const firstDayOfWeek = 1; // monday as the first day (0 = sunday)
  const startOfYear = new Date(day.getFullYear(), 0, 1);
  startOfYear.setDate(
    startOfYear.getDate() + (firstDayOfWeek - (startOfYear.getDay() % 7))
  );
  return Math.round((day - startOfYear) / MILLISECONDS_IN_WEEK) + 1;
}

const actualWeek = getDayOfWeek()
const formatUrl = (route) => `https://www.reddit.com${route}`

const selectors = {
  postContent: 'div[data-test-id="post-content"]'
}

/* -----------------------------
 *  Database Functions
 * -----------------------------
*/
let db = null
const setCloudant = (params) => new Cloudant({
  account: params.CLOUDANT_ACCOUNT,
  plugins: {
    iamauth: {
      iamApiKey: params.IAM_API_KEY
    }
  }
});

const connectDB = (params) => {
  console.log('Connecting with Cloudant...')

  const cloudant = setCloudant(params)
  db = cloudant.use('one-piece')
}

const checkIfShouldStart = () => {
  console.log('Checking if there is a manga for this week')

  return new Promise((resolve, reject) => {
    db.find({ selector: { week: actualWeek }})
      .then((resultSet) => {
        if (resultSet.docs.length > 0) {
          console.log('Finishing job because it is a manga already')
          reject()
          return;
        }
        console.log('No manga detect, starting application...')
        resolve()
      })
      .catch((err) => {
        console.log('Something happened...', err)
        reject()
      })
  })
}

const saveResult = (url) => {
  console.log('Saving results into Cloudant...')

  const mangaDetails = {
    week: actualWeek,
    url,
  }

  return db.insert(mangaDetails)
}

/* -----------------------------
 *  Fetching Functions
 * -----------------------------
*/
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

/* -----------------------------
 *  Parsing functions
 * -----------------------------
*/

const parsePostList = (htmlDocument) => {
  console.log('Initiating parsing... ')

  return new Promise((resolve, reject) => {
    const { document } = new JSDOM(htmlDocument).window

    const headers = [...document.querySelectorAll('a')]
      .filter(el => el.textContent.match(/Chapter.[0-9]+/g))
      .map(el => el.href)
      .map(formatUrl)

    if (headers.length > 0) {
      console.log('Found: ', headers[0])
      resolve(headers[0])
      return;
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
      .filter(el => el.match(/read/g))

    if (urls.length > 0) {
      console.log('Found: ', urls[0])
      resolve(urls[0])
      return;
    }
    console.error('Not found any url link, aborting...')
    reject()
  })
}

/* -----------------------------
 *  Telegram part
 * -----------------------------
*/

const sendMessageOnTelegram = ({ACCESS_TOKEN, CHAT_ID}) => (url) => {
  console.log('Sending message to Telegram')

  return fetch(`https://api.telegram.org/bot${ACCESS_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      'chat_id': CHAT_ID,
      // This is the only string in Portuguese because this bot is made
      // to announce mangas in a group I'm part of
      text: `Mangá anunciado! ${url}`
    })
  })
}

/* -----------------------------
 *  Main part
 * -----------------------------
*/

const finishJob = (params) => (mangaUrl) => {
  console.log('Finishing job...')

  return Promise.all([
    saveResult(mangaUrl),
    sendMessageOnTelegram(params)(mangaUrl)
  ])
}

function main(params) {
  connectDB(params)

  return checkIfShouldStart()
    .then(fetchPost)
    .then(parsePostList)
    .then(fetchMangaUrl)
    .then(parseMangaPost)
    .then(finishJob(params))
    .then(() => ({ message: 'Sent' }))
    .catch(err => ({ message: err }))
}
