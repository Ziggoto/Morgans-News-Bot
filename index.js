const fetch = require('node-fetch')
const jsdom = require('jsdom')
const config = require('dotenv').config()

const { JSDOM } = jsdom

const formatUrl = (route) => `https://www.reddit.com${route}`

const fetchPost = () => {
    return fetch('https://www.reddit.com/r/OnePiece/')
        .then(response => response.text())
}

const sendMessageOnTelegram = (url) => {
    const { ACCESS_TOKEN } = process.env

    fetch(`https://api.telegram.org/bot${ACCESS_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            'chat_id': 59761682,
            text: `Opa, boas noticias: ${url}`
        })
    })
}

const main = async () => {
    const htmlDocument = await fetchPost()
    const { document } = new JSDOM(htmlDocument).window

    const headers = [...document.querySelectorAll('span')]
        .filter(el => el.textContent.match(/Current Chapter/))

    const links = headers
        .map(el => el.parentElement.href)
        .map(formatUrl)

    if (links.length > 0) {
        console.log(`Encontrado: ${links[0]}`)
        sendMessageOnTelegram(links[0])
    } else {
        console.log('Nenhum manga novo encontrado!')
    }
}

main()
