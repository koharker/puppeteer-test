//const chromium = require('chrome-aws-lambda');
const puppeteer = require("puppeteer");
const Vex = require("vexflow");
require("dotenv").config();

const {
    Renderer,
    Beam,
    Stave,
    Formatter,
    StaveNote,
    Accidental,
    StaveLine
} = Vex.Flow;



const vexflowNoteRender = async (req, res) => {
    const {
        notes = 'c4',
        rhythm = 'h',
        clef = 'treble',
        scale = 1
    }  =  req.query;

    // INSERT LOGIC for notes
    // d4,c3 puts notes on top of one another
    // d4;c3 puts notes next to one another

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
        const notesInVexflowFormat = reformatNoteRequest(notes);
        const parsedVexflowNoteObjects  = parseVexflowNoteArray(notesInVexflowFormat)
        const vexflowNoteObjectPackage = packageVexflowNoteObjectArray(parsedVexflowNoteObjects);
        const vexflowNoteObjectArrayHtmlString = generateVexflowNoteObjectArrayHtmlString(parsedVexflowNoteObjects);

        console.log(parsedVexflowNoteObjects[0].string)
        // Launch the browser and open a new blank page
        const page = await browser.newPage();
        
        // Your page content setup goes here, including VexFlow initialization
        await page.setContent(`
            <!DOCTYPE html>
                <html>
                <body>
                    <div id="output" ></div>
                    <script src="https://cdn.jsdelivr.net/npm/vexflow@4.0.1/build/cjs/vexflow.js"></script>
                    <script>
                    // Initialize VexFlow and render notation
                    // Example: var vf = new Vex.Flow.Factory({renderer: {elementId: 'notation', width: 500, height: 200}});
                    // You would replace the following line with your VexFlow initialization code, using the 'data' variable
                    
        
                    const {
                        Renderer,
                        Beam,
                        Stave,
                        Formatter,
                        StaveNote,
                        Accidental,
                        StaveLine
                    } = Vex.Flow;
            
                    // Create an SVG renderer and attach it to the DIV element with id="output".
                    const div = document.getElementById('output');
                    const renderer = new Renderer(div, Renderer.Backends.SVG);
                    const scale = ${scale};
                    
                    // Configure the rendering context.
                    renderer.resize(161 * scale, 110 * scale);
                    const context = renderer.getContext();
                    context.setFont('Arial', 10);
                    context.scale(scale, scale);
            
                    // Create a stave of width 400 at position 10, 40.
                    const stave = new Stave(10, -5, 150);
            
                    // Add a clef and time signature.
                    stave.addClef('${clef}');
            
                    // Connect it to the rendering context and draw!
                    stave.setContext(context).draw();
            
            
                    const notes = [${vexflowNoteObjectArrayHtmlString}];
            
                    const beams = Beam.generateBeams(notes);
                    Formatter.FormatAndDraw(context, stave, notes);
            
            
                    const lines =  [
                        new StaveLine({
                        first_note: notes[0],
                        last_note: notes[1],
                        first_indices: [0],
                        last_indices: [0],
                        })
                    ];
            
            
                    lines.forEach((l) => {
                        l.setContext(context).draw()
                    });
                    
                    </script>
                </body>
            </html>
        `);

        // Puppeteer operations to capture the screenshot
        const imageBuffer = await page.screenshot({
            type: 'png', // Specify the image type ('png' or 'jpeg')
            fullPage: false, // Set to true to capture the entire page
            clip: { x: 8, y: 8, width: 171 * scale, height: 112 * scale },
            //clip: { x: 8, y: 8, width: 302, height: 224 }, //use to cut image to barlines with no side padding.
            //vexflow bounds are from barline to barline. new Stave of width 150 is actually 320 (when staff is resized x2)
        });

        const noteImage = {
            statusCode: 200,
            headers: { 'Content-Type': 'image/png' },
            body: imageBuffer.toString('base64'),
            isBase64Encoded: true,
        };

        //res.type('image/png').send(imageBuffer);

        const queryDetails  = `vexflowNoteRender received notes: ${notesInVexflowFormat || null}, rhythm: ${rhythm || null}, clef: ${clef || null}, scale: ${scale || null}!`

        res.send(queryDetails);
    } catch(e) {
        console.error(e);
        res.send(`Something went wrong: ${e}`)
    } finally {
        await browser.close();
    };
};

/*
    const page = await browser.newPage();

    // Your page content setup goes here, including VexFlow initialization
    // Replace this HTML with your actual HTML setup for VexFlow
    await page.setContent(`
       <!DOCTYPE html>
        <html>
        <body>
            <div id="output" ></div>
            <script src="https://cdn.jsdelivr.net/npm/vexflow@4.0.1/build/cjs/vexflow.js"></script>
            <script>
            // Initialize VexFlow and render notation
            // Example: var vf = new Vex.Flow.Factory({renderer: {elementId: 'notation', width: 500, height: 200}});
            // You would replace the following line with your VexFlow initialization code, using the 'data' variable
            

            const {
                Renderer,
                Beam,
                Stave,
                Formatter,
                StaveNote,
                Accidental,
                StaveLine
              } = Vex.Flow;
      
              // Create an SVG renderer and attach it to the DIV element with id="output".
              const div = document.getElementById('output');
              const renderer = new Renderer(div, Renderer.Backends.SVG);
              const scale = 2;
              
              // Configure the rendering context.
              renderer.resize(161 * scale, 110 * scale);
              const context = renderer.getContext();
              context.setFont('Arial', 10);
              context.scale(scale, scale);
      
              // Create a stave of width 400 at position 10, 40.
              const stave = new Stave(10, -5, 150);
      
              // Add a clef and time signature.
              stave.addClef('treble');
      
              // Connect it to the rendering context and draw!
              stave.setContext(context).draw();
      
      
              const notes = [
                new StaveNote({
                  keys: ['gn/4'],
                  duration: 'h'
                }).addModifier(new Accidental('n')),
                new StaveNote({
                  keys: ['c/5'],
                  duration: 'h'
                })
              ];
      
              const beams = Beam.generateBeams(notes);
              Formatter.FormatAndDraw(context, stave, notes);
      
      
              const lines =  [
                new StaveLine({
                  first_note: notes[0],
                  last_note: notes[1],
                  first_indices: [0],
                  last_indices: [0],
                })
              ];
      
      
              lines.forEach((l) => {
                l.setContext(context).draw()
              });
            
            </script>
        </body>
        </html>
    `);

    // Puppeteer operations to capture the screenshot
    const imageBuffer = await page.screenshot({
        type: 'png', // Specify the image type ('png' or 'jpeg')
        fullPage: false, // Set to true to capture the entire page
        clip: { x: 8, y: 8, width: 342, height: 224 },
        //clip: { x: 8, y: 8, width: 302, height: 224 }, //use to cut image to barlines with no side padding.
        //vexflow bounds are from barline to barline. new Stave of width 150 is actually 320 (when staff is resized x2)
    });

    await browser.close();

    // Return the image as a response
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'image/png' },
        body: imageBuffer.toString('base64'),
        isBase64Encoded: true,
    };
};

*/

function convertRequestSyntaxToVexflow(noteRequest, rhythmRequest, clefRequest, keyRequest, timeRequest, scaleRequest)  {
    const { parsedNotes, parsedSeparators, parsedRhythm, parsedClef, parsedKey, parsedTime, parsedScale } =  parseRequest(noteRequest, rhythmRequest, clefRequest, keyRequest, timeRequest, scaleRequest)
    const [ vexflowNotes, vexflowSeparators ] = convertParsedNoteRequestSyntaxToVexflow(parsedNotes);
}

function convertParsedNoteRequestSyntaxToVexflow(parsedNotes)  {
    const {vexflowNotes, vexflowRests} = parseNotesAndRestsFromParsedNoteRequest(parsedNotes)
}

function parseNotesAndRestsFromParsedNoteRequest(parsedNotes) {


}




/** logic for parsing http request */
function parseRequest(noteRequest, rhythmRequest, clefRequest, keyRequest, timeRequest, scaleRequest) {
    const {parsedNotes, parsedSeparators} = parseNoteRequest(noteRequest);
    return {parsedNotes, parsedSeparators, parsedRhythm}
};



function reformatNoteRequest(noteReq)  {
    const sanitizedNoteRequest =  sanitizeNoteRequest(noteReq);
    const noteArrayInVexflowSyntax  =  changeNoteRequestSyntaxToVexflow(sanitizedNoteRequest)
    
    validateNoteSyntax(noteArrayInVexflowSyntax);
    
    return noteArrayInVexflowSyntax;
}

function changeNoteRequestSyntaxToVexflow(noteReq) {
    const noteReqs = noteReq.split(",");
    let vexflowNoteReqs = noteReqs.map((note) =>  {
        const rxLetter = /\D*/
        return note.replace(rxLetter, (match) => match + '/').replace(/\*/g, "#")
    });

    return vexflowNoteReqs;
};

function sanitizeNoteRequest(noteReq) {
    const lowercaseNoteReq = noteReq.toLowerCase();
    const sanitizedNoteReq = lowercaseNoteReq.replace(';', ",");

    return sanitizedNoteReq;
};

function validateNoteSyntax(vexflowNoteArray) {
    const rxVexflowNoteSyntax  = /^[a-g](b{0,2}?|#{0,2}?|n{0,1}?)\/\d$/;
    vexflowNoteArray.map(note => {
        if(!rxVexflowNoteSyntax.test(note)) {
            throw new Error(
                `Note: ${note} is invalid.`
            )
        }
    })
} 

function parseVexflowNoteArray(vexflowNoteArray){
    //separate the note strings into 
    const vexflowNoteObjectArray = vexflowNoteArray.map((noteString) => {
        const [ note, octave ] = noteString.split('/');
        const [ letter, ...accidentalArray ]  = note.split('');
        const accidental = accidentalArray.join('');
        
        const vexflowNoteObject = {
            string: noteString,
        	letter: letter,
        	accidental: accidental,
       		octave: +octave
        };

        return vexflowNoteObject;
    });

    return vexflowNoteObjectArray;
};




function generateVexflowNoteObjectArrayHtmlString(vexflowNoteObjectArray) {
    const htmlString = vexflowNoteObjectArray.map(noteObj => {
        let newNoteString = `new StaveNote({keys: ['${noteObj.string}'], duration: 'h'})`
        if (noteObj.accidental) {
            newNoteString  += `.addModifier(new Accidental('${noteObj.accidental}'))`
        }
        return newNoteString
    }).join();

    console.log(htmlString);
    return htmlString;
};



/** Logic for parsing the note request */


function parseNoteRequest(noteRequest) {
    validateNoteRequestSyntax(noteRequest);  //throws an error if note request
    const { extractedNotes, extractedSeparators } = extractNotesAndSeparatorsFromNoteRequest(noteRequest);
    const [parsedNotes, parsedSeparators] = [extractedNotes, extractedSeparators];
    return {parsedNotes, parsedSeparators}
};

function validateNoteRequestSyntax(noteRequest) {
    const rxValidNoteRequestSyntax = /^(([a-g](b{0,2}?|\*{0,2}?|n{0,1}?)\d)|r)((,|t|s|\||~|l)(([a-g](b{0,2}?|\*{0,2}?|n{0,1}?)\d)|r))*$/g
    if(!rxValidNoteRequestSyntax.test(noteRequest)) {
        throw new Error(
            `Note request contains invalid syntax: ${noteRequest} is invalid.`
        )
    }
}

function extractNotesAndSeparatorsFromNoteRequest(noteRequest)  {
    const parsedNotes = extractNotesFromNoteRequest(noteRequest);
    const parsedSeparators = extractSeparatorsFromNoteRequest(noteRequest);
    return {parsedNotes, parsedSeparators};
};

function extractNotesFromNoteRequest(noteRequest) {
    const rxValidNoteSyntax = /([a-g](b{0,2}?|\*{0,2}?|n{0,1}?)\d)|r/g
    const notes = noteRequest.match(rxValidNoteSyntax);
    return notes;
};

function extractSeparatorsFromNoteRequest(noteRequest) {
    const validNoteSeparators = [
        ',', //default separatorindicating a new note in the sequence
        't', //connects sequential notes with a tie
        's', //connects sequential notes with a slur
        'l', //connects sequential notes with a solid line
        '~', //connects sequential notes with a gliss
        '|', //connects sequential notes with a barline
        ';'  //starts a new sequence of notes in another voice
    ];

    const validNoteSeparatorRegExpString = escapeRegExpChars(validNoteSeparators).join('|');
    const rxValidNoteSeparators = new RegExp(validNoteSeparatorRegExpString, 'g');
    const requestedNoteSeparators = noteRequest.match(rxValidNoteSeparators);

	return requestedNoteSeparators;
};




/**
 * Escapes RegExp special characters within strings. This function can take multiple arguments,
 * each of which can be either a string or an array of strings. It performs a replace operation
 * on each string to escape all RegExp special characters, then returns the results in the same
 * format as provided (i.e., a single string for a single string input, or an array of strings
 * if provided with an array or multiple arguments).
 *
 * @param {...(string|string[])} args - A variable number of arguments where each can be either
 *                                      a string or an array of strings.
 * @returns {(string|string[]|Array)} - The input argument(s) with all RegExp special characters
 *                                      escaped. The return type matches the format of the input:
 *                                      - A single string if a single string was provided.
 *                                      - An array of strings if the input was an array or multiple
 *                                        arguments were provided.
 */
function escapeRegExpChars(...args) {
    // Helper function to escape special characters in a string
    const escapeString = (str) => str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
  
    // Process each argument
    const processedArgs = args.map(arg => {
      if (Array.isArray(arg)) {
        // If the argument is an array, escape each string in the array
        return arg.map(item => typeof item === 'string' ? escapeString(item) : item);
      } else if (typeof arg === 'string') {
        // If the argument is a string, escape it
        return escapeString(arg);
      } else {
        // Return the argument unchanged if it's neither a string nor an array
        return arg;
      }
    });
  
    // If there's only one argument and it's not an array, return it directly
    if (processedArgs.length === 1 && !Array.isArray(args[0])) {
      return processedArgs[0];
    }
  
    // Return the processed arguments. If only one argument and it's an array, return just the array.
    return processedArgs.length === 1 ? processedArgs[0] : processedArgs;
};
  



function splitByAny(string, separatorArray) {}




function packageVexflowNoteObjectArray(vexflowNoteObjectArray) {
    /*
    const notes = [
        new StaveNote({
          keys: ['bb/4'],
          duration: 'h'
        }).addModifier(new Accidental('b')),
        new StaveNote({
          keys: ['g/5'],
          duration: 'h'
        })
      ];
*/
    console.log(vexflowNoteObjectArray)
    const vexnotes = vexflowNoteObjectArray.map((noteObj) => {
        console.log(noteObj)
        const testnote  = 'b/4'
        const testnoteobj = {
            string: 'b/4'
        }
        console.log(testnote)
        console.log(testnoteobj.string)
        console.log(noteObj.string)
        console.log('end test notes')

        const testvexnote = {
            keys: [testnoteobj.string]
        }

        console.log(testvexnote.keys)
        const _note = new StaveNote({
            keys: [noteObj.string],
            duration: 'h'
        });
        console.log(_note)
        noteObj.accidental && _note.addModifier(new Accidental(noteObj.accidental));

        return _note;
    })

    return vexnotes;
}

module.exports = { vexflowNoteRender };