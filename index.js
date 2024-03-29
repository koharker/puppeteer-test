const express = require("express");
const { scrapeLogic } = require("./scrapeLogic");
const { vexflowNoteRender } = require("./vexflowNoteRender");
const app = express();

const PORT = process.env.PORT  || 4000;

app.get("/scrape", (req, res) => {
    scrapeLogic(res);
})

app.get("/generate_notes", (req, res) => {
    vexflowNoteRender(req, res);
})

app.get("/", (req, res) => {
    res.send("Render Puppeteer server is up and running")
});

app.listen(4000, () => {
    console.log(`listening on port ${PORT}`)
});