const puppeteer = require("puppeteer");
require("dotenv").config();

const scrapeLogic = async (res) => {
    const browser = await puppeteer.launch({
        args: [
            "--disable-setuid-sandbox",
            "--no-sandbox",
            "--single-process",
            "--no_zygote",
        ],
        executablePath:
            process.env.NODE_ENV === "production"
                ? process.env.PUPPETEER_EXECUTABLE_PATH
                :  puppeteer.executablePath(),
    });
    try {
        // Launch the browser and open a new blank page

        const page = await browser.newPage();

        // Navigate the page to a URL
        await page.goto('https://developer.chrome.com/');

        // Set screen size
        await page.setViewport({width: 1080, height: 1024});

        // Type into search box
        await page.type('.devsite-search-field', 'automate beyond recorder');

        // Wait and click on first result
        const searchResultSelector = '.devsite-result-item-link';
        await page.waitForSelector(searchResultSelector);
        await page.evaluate((selector) => {
            document.querySelector(selector).click();
        }, searchResultSelector);

        // Locate the full title with a unique string
        const textSelector = await page.waitForSelector(
            'text/Customize and automate'
        );
        const fullTitle = await textSelector?.evaluate(el => el.textContent);

        // Print the full title
        const logStatement = `The title of this blog post is ${fullTitle}`;
        console.log(logStatement);
        res.send(logStatement);
    } catch(e) {
        console.error(e);
        res.send(`Something went wrong while running Puppeteer: ${e}`)
    } finally {
        await browser.close();
    }

};

module.exports = { scrapeLogic };