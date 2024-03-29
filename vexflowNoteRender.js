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


/** RENDER WIDTH OF VEXFLOW ELEMENTS - vexflowElemRenderWidth - add and subtract these widths from stave(x,y, WIDTH) to keep
 * the staff the same width when you add or remove elements to it.
*/
const vexflowElemRenderWidth = {
    ['#']: 11,
    b: 10,
    keySigBuffer: 9.5, // width for key signatures = (noOfAccidentals x accidental) + keySigBuffer
    clef: 36, //all clefs same width
    //time sig width is always the width of the WIDEST symbol
    2: 29.5,
    3: 28.5,
    4: 30,
    8: 29,
    10: 40.25,
    11: 34,
    16: 39.25,
    C: 32,
}

console.log(vexflowElemRenderWidth["#"])
/** DEFAULT IMAGE RENDER SETTINGS - renders 2 notes with standard padding around staff */
const defaultImageRenderSettings = {
    vexflowRenderContext: {
        resizeWidth: 161,
        resizeHeight: 110
    },
    vexflowStaff: {
        x: 10,
        y: -5,
        width: 150
    },
    screenshotClipSettings: { 
        x: 8, y: 8, width: 171, height: 112
    }
}


const vexflowNoteRender = async (req, res) => {
    const {
        notes = 'c4',
        rhythm = 'w',
        articulations = '',
        noteheads = '',  //see vexflow.js for types. search for "V.validTypes" and "static codeNoteHead()"
        clef = 'treble',
        key = 'C',
        time = '',
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
        const vexflowNoteObjectArray = convertRequestSyntaxToVexflow(notes, rhythm, articulations, noteheads, clef, key, time, scale)

        //const notesInVexflowFormatOLD = reformatNoteRequest(notes);
        //const parsedVexflowNoteObjectsOLD  = parseVexflowNoteArray(notesInVexflowFormatOLD)
        //const vexflowNoteObjectPackage = packageVexflowNoteObjectArray(parsedVexflowNoteObjectsOLD);
        //const vexflowNoteObjectArrayHtmlStringOLD = generateVexflowNoteObjectArrayHtmlStringOLD(parsedVexflowNoteObjectsOLD);

        const vexflowNoteObjectArrayHtmlString  = generateVexflowNoteObjectArrayHtmlString(vexflowNoteObjectArray)

        //console.log(parsedVexflowNoteObjectsOLD[0].string)
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

        res.type('image/png').send(imageBuffer);

        //const queryDetails  = `vexflowNoteRender received notes: ${notesInVexflowFormatOLD || null}, rhythm: ${rhythm || null}, clef: ${clef || null}, scale: ${scale || null}!`

        //res.send(queryDetails);
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

function convertRequestSyntaxToVexflow(noteRequest, rhythmRequest, articulationRequest, noteheadRequest, clefRequest, keyRequest, timeRequest, scaleRequest)  {
    const { parsedNotes, parsedNoteSeparators, parsedRhythm, parsedRhythmSeparators, parsedClef, parsedKey, parsedTime, parsedScale } =  parseRequest(noteRequest, rhythmRequest, articulationRequest, noteheadRequest, clefRequest, keyRequest, timeRequest, scaleRequest);
    const { vexflowNotes, vexflowAccidentals, vexflowRests } = processParsedNoteRequestSyntaxToVexflow(parsedNotes);
    
    //vexflow durations include rest data
    const vexflowDurations = processParsedRhythmSyntaxToVexflow(parsedRhythm, vexflowRests);
    const vexflowClef = parsedClef;
    const vexflowNoteObjectArray = packageVexflowNotes(vexflowNotes, vexflowAccidentals, vexflowDurations, vexflowClef);
    
    console.log(vexflowNoteObjectArray);
    return vexflowNoteObjectArray;
}

/** PROCESS NOTES FOR VEXFLOW */
// Main function to process notes and clef
function processParsedNoteRequestSyntaxToVexflow(parsedNotes)  {
    const  { vexflowNotes, vexflowRests} = convertNotesAndRestsFromParsedNoteRequestToVexflow(parsedNotes)
    const vexflowAccidentals = extractAccidentals(vexflowNotes)

    console.log('vexflowNotes, Accidentals, Rests', vexflowNotes, vexflowAccidentals, vexflowRests)
    return { vexflowNotes, vexflowAccidentals, vexflowRests}
}

function convertNotesAndRestsFromParsedNoteRequestToVexflow(parsedNotes) { 
    const vexflowNotes  = convertToVexflowNotes(parsedNotes)
    const vexflowRests = generateRestIndicators(parsedNotes);
    return { vexflowNotes, vexflowRests };
    
}

// Converts parsed notes to VexFlow notes, handling rests separately
function convertToVexflowNotes(parsedNotes) {
    return parsedNotes.map(note => note === 'r' ? 'b/4' : convertNoteToVexflowNoteSyntax(note));
}

function  convertNoteToVexflowNoteSyntax(note) {
    const rxLetter = /\D*/
    return note.replace(rxLetter, (match) => match + '/').replace(/\*/g, "#")
}

// Generates the rest indicators for VexFlow, 'n' for notes and 'r' for rests
function generateRestIndicators(parsedNotes) {
    return parsedNotes.map(note => note === 'r' ? 'r' : 'n');
}

function extractAccidentals(parsedNotes) {
    const vexflowAccidentals = parsedNotes.map(note => {
        return note.length === 5 ? note[1] + note[2] : note.length === 4 ? note[1]  : '' ;
    })
    return vexflowAccidentals
}

/** Logic for converting rhythm request to Vexflow durations */
function processParsedRhythmSyntaxToVexflow(parsedRhythm, vexflowRests) {
    const vexflowDurations = parsedRhythm.map((note, index) => {
        return vexflowRests[index] == 'n' ? note : note+'r';
    })

    console.log('vexflowDurations', vexflowDurations)
    return vexflowDurations;
}


/** Logic for packaging note, rest, accidental, duration, articulation,
 * notehead, and clef info into a vexflow note object
 */

function packageVexflowNotes(vexflowNotes, vexflowAccidentals, vexflowDurations, vexflowClef) {
    console.log(vexflowDurations)
    let vexflowNoteObjectArray = [];
    for (var i = 0; i < vexflowNotes.length; i++) {
        console.log(vexflowNotes[i])
        let note = {};
        note.key = vexflowNotes[i];
        note.accidental = vexflowAccidentals[i] ?? null;
        note.duration = vexflowDurations[i];
        note.clef = vexflowClef;

        vexflowNoteObjectArray.push(note);
    };

    console.log('vexflowNoteObjectArray', vexflowNoteObjectArray)
    return vexflowNoteObjectArray;
}




function generateVexflowNoteObjectArrayHtmlString(vexflowNoteObjectArray) {
    const htmlString = vexflowNoteObjectArray.map(noteObj => {
        let newNoteString = `new StaveNote({keys: ['${noteObj.key}'], duration: '${noteObj.duration}', clef: '${noteObj.clef}'})`
        if (noteObj.accidental) {
            newNoteString  += `.addModifier(new Accidental('${noteObj.accidental}'))`
        }
        return newNoteString
    }).join();

    console.log(htmlString);
    return htmlString;
};





// Transposes a single note based on the clef
function transposeNote(note, clef) {
    const bassClefTransposition = {
        'c': 'a', 'd': 'b', 'e': 'c', 'f': 'd', 'g': 'e', 'a': 'f', 'b': 'g',
        'gb': 'eb', // Add more specific rules as needed
    };

    if (clef === 'bass') {
        const noteLetter = note[0];
        const accidental = note.length === 3 ? note[1] : '';
        let octave = parseInt(note[note.length - 1], 10);

        // Adjust the note and octave
        const newNote = bassClefTransposition[noteLetter.toLowerCase()] + accidental;
        octave = (octave - 1) < 0 ? 4 : octave - 1; // Simplistic octave adjustment for the example

        return newNote + '/' + octave;
    }

    // Add cases for other clefs if necessary
    return note;
}




function processNotes(parsedNotes, parsedClef) {
    const vexflowNotes = convertToVexflowNotes(parsedNotes, parsedClef);
    const vexflowRests = generateRestIndicators(parsedNotes);

    return { vexflowNotes, vexflowRests };
}

// Example usage
const parsedNotes = ['c4', 'r', 'gb3', 'r', 'd4'];
const parsedClef = 'bass';
const { vexflowNotes, vexflowRests } = processNotes(parsedNotes, parsedClef);

console.log(vexflowNotes);
console.log(vexflowRests);






/** PARSE HTTP REQUEST - Logic for parsing http request */
function parseRequest(noteRequest, rhythmRequest, articulationRequest, noteheadRequest, clefRequest, keyRequest, timeRequest, scaleRequest) {
    const {parsedNotes, parsedNoteSeparators} = parseNoteRequest(noteRequest);
    const { parsedRhythm, parsedRhythmSeparators } = parseRhythmRequest(rhythmRequest);
    const parsedClef = parseClefRequest(clefRequest);
    console.log(parsedNotes, parsedNoteSeparators, parsedRhythm, parsedRhythmSeparators, parsedClef)
    return {parsedNotes, parsedNoteSeparators, parsedRhythm, parsedRhythmSeparators, parsedClef}
};


/** PARSE NOTE REQUEST - Logic for parsing the note request */

function parseNoteRequest(noteRequest) {
    validateNoteRequestSyntax(noteRequest);  //throws an error if note request
    const { extractedNotes, extractedSeparators } = extractNotesAndSeparatorsFromNoteRequest(noteRequest);
    const [parsedNotes, parsedNoteSeparators] = [extractedNotes, extractedSeparators];
    return {parsedNotes, parsedNoteSeparators}
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
    const extractedNotes = extractNotesFromNoteRequest(noteRequest);
    const extractedSeparators = extractSeparatorsFromNoteRequest(noteRequest);
    return {extractedNotes, extractedSeparators};
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

/** PARSE RHYTHM REQUEST - Logic for parsing the rhythm request */
function parseRhythmRequest(rhythmRequest) {
    validateRhythmRequestSyntax(rhythmRequest); //throws an error if invalid syntax
    const { extractedRhythm, extractedRhythmSeparators } = extractRhythmAndSeparatorsFromRhythmRequest(rhythmRequest);
    const [parsedRhythm, parsedRhythmSeparators] = [extractedRhythm, extractedRhythmSeparators];
    return {parsedRhythm, parsedRhythmSeparators}
};

function validateRhythmRequestSyntax(rhythmRequest) {
    const rxValidRhythmRequestSyntax = /((w|h|q|8|16|32)\.{0,2})((,|;|\|)(w|h|q|8|16|32)\.{0,2})*/g;
    if(!rxValidRhythmRequestSyntax.test(rhythmRequest)) {
        throw new Error(
            `Rhythm request contains invalid syntax: ${rhythmRequest} is invalid.`
        )
    }
}

function extractRhythmAndSeparatorsFromRhythmRequest(rhythmRequest) {
    const extractedRhythm = extractRhythmFromRhythmRequest(rhythmRequest);
    const extractedRhythmSeparators = extractSeparatorsFromRhythmRequest(rhythmRequest);
    return {extractedRhythm, extractedRhythmSeparators};
};

function extractRhythmFromRhythmRequest(rhythmRequest) {
    const rxValidRhythmSyntax = /(w|h|q|8|16|32)\.{0,2}/g
    const rhythm = rhythmRequest.match(rxValidRhythmSyntax);
    return rhythm;
};

function extractSeparatorsFromRhythmRequest(rhythmRequest) {
    const validRhythmSeparators = [
        ',', //default separatorindicating a new note duration in the sequence
        '|', //connects sequential notes with a barline
        ';'  //starts a new sequence of rhythms in another voice
    ];

    const validRhythmSeparatorRegExpString = escapeRegExpChars(validRhythmSeparators).join('|');
    const rxValidRhythmSeparators = new RegExp(validRhythmSeparatorRegExpString, 'g');
    const requestedRhythmSeparators = rhythmRequest.match(rxValidRhythmSeparators);

	return requestedRhythmSeparators;
};


/** PARSE CLEF REQUEST - Logic for parsing clef request */
function parseClefRequest(clefRequest){
    const sanitizedClefRequest = clefRequest.toLowerCase();
    validateClefRequestSyntax(sanitizedClefRequest);
    return sanitizedClefRequest;
};

function validateClefRequestSyntax(clefRequest) {
    const validClefs = [
        'treble',
        'bass',
        'alto',
        'tenor',
        'percussion',
        'soprano',
        'mezzo-soprano',
        'baritone-c',
        'baritone-f',
        'subbass',
        'french',
        'tab'
    ];

    if(!validClefs.includes(clefRequest)) {
        throw new Error(
            `Clef request contains invalid syntax: ${clefRequest} is invalid.`
        );
    };
};


/** BEGIN OLD PARSING LOGIC (slowly deprecating old parsing logic...)*/
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




function generateVexflowNoteObjectArrayHtmlStringOLD(vexflowNoteObjectArray) {
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
/** END OLD PARSING LOGIC */





/** GENERAL FUNCTIONS */

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