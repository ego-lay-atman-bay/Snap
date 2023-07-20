// extension functions

SnapExtensions.primitives.set(
    'ts_setinst(name)',
    function (name) {
        TuneScope.currentInstrumentName = name.toLowerCase();
    }
);

SnapExtensions.primitives.set(
    'ts_setvol(percent)',
    function (percent) {
        let adjusted_percent = (percent === 0) ? 0.0001: percent;
        TuneScope.globalInstrumentVolume = adjusted_percent/100.0;
    }
);

SnapExtensions.primitives.set(
    'ts_setinstvol(name, percent)',
    function (instrumentName, percent) {
        instrumentName = instrumentName.toLowerCase();
        let adjusted_percent = (percent === 0) ? 0.0001: percent;
        TuneScope.instrumentVolumes[instrumentName] = adjusted_percent/100.0;
    }
);

SnapExtensions.primitives.set(
    'ts_playnote(note, duration)',
    function (note, noteLength) {
        TuneScope.playNote(note, noteLength, );
    }
);

SnapExtensions.primitives.set(
    'ts_playnoteIns(note, duration, instrument)',
    function (note, noteLength, instrument) {
        TuneScope.playNote(note, noteLength, instrument.toLowerCase());
    }
);

SnapExtensions.primitives.set(
    'ts_getcurrentnote()',
    function () {
        return TuneScope.currentNote
    }
)

SnapExtensions.primitives.set(
    'ts_parsemidifile()',
    function () {
        const getMidiFile = async () => {
            TuneScope.midi.parsed = "";
            fileMidi = await window._selectFile(".mid", false);
            const arrayBuffer = await fileMidi.arrayBuffer()
            const parsedMidi = await new window.Midi(arrayBuffer)
            TuneScope.midi.parsed = parsedMidi.toJSON();
            world.children[0].broadcast("ts_file_input_received")
        }
        getMidiFile();
    }
)

SnapExtensions.primitives.set(
    'ts_getparsed()',
    function() {
        world.children[0].broadcast("ts_no_file_upload")
        let temp = window._objToArray(TuneScope.midi.parsed);
        temp = window.convertArrayToListRecursive(temp);
        return temp;
    }
);

SnapExtensions.primitives.set(
    'ts_playMIDI(controller, instrument)',
    function (controller_name, instrument_name) {

        function onEnabled(controller, instrument) {
            let synth = window.WebMidi.getInputByName(controller);
            let keyboard = synth.channels[1];
            //remove any existing listeners
            keyboard.removeListener("noteon")

            // Listener for the keyboard, prints midi note number
            keyboard.addListener("noteon", e => {
                TuneScope.playNote(e.note.identifier, 0.5, instrument);
            });
        }

        const playMidiController = async (controller, instrument) => {
            if(controller === null || controller === "") return;

            //enables the webmidi controller, doesn't record notes
            window.WebMidi.enable((err) => {
                if (err) {
                    alert(err);
                } else {
                    onEnabled(controller, instrument);
                }
            });
        }

        playMidiController(controller_name, instrument_name);
    }
);

SnapExtensions.primitives.set(
    'ts_stopMIDI()',
    function() {
        window.WebMidi.disable();
    }
)

SnapExtensions.primitives.set(
    'ts_settone(id, frequency, amplitude, balance)',
    function (id, freq, ampl, bal) {
        var created = false;
        if (!window.tones[id]) {
          TuneScope.tones[id] = new window.Tone(id);
          created = true;
        } else {
            TuneScope.tones[id].turnOff();
            created = true;
        }

        TuneScope.tones[id].setFreq(freq);
        TuneScope.tones[id].setAmpl(ampl * 100);
        TuneScope.tones[id].setPan(bal);
        created && TuneScope.tones[id].turnOn();
    }
);

SnapExtensions.primitives.set(
    'ts_turntoneon(id, bool)',
    function (id, on) {
        if (!TuneScope.tones[id]) {
          return;
        }

        if (on) {
          TuneScope.tones[id].turnOn();
        } else {
          TuneScope.tones[id].turnOff();
        }
    }
);

SnapExtensions.primitives.set(
    'ts_stoptones()',
    function () {
        const vals = Object.values(TuneScope.tones);

        for (let i = 0; i < vals.length; i++) {
          const currTone = vals[i];
          currTone.turnOff();
        }
    }
);

SnapExtensions.primitives.set(
    'ts_loaded()',
    function () {
        return TuneScope.loadedTuneScope === true;
    }
);

SnapExtensions.primitives.set(
    'ts_playtracks(tracklist, timesignature, tempo)',
    function (tracksList, timeSignature, tempo) {
        TuneScope._ts_pausePlayback = false;
        const multiplyArray = (arr, length) =>
          Array.from({ length }, () => arr).flat()

        const wait = (duration) => {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve();
                }, duration)
            })
        }

        const playTrackMeasure = async (currTrack, measureIndex, beatsPerMeasure, tempo, instrument) => {
            var elapsedMeasureTime = 0;
            const timeEndIndex = beatsPerMeasure[0] * (TuneScope.baseTempo / tempo);

            /**
             * We can calculate in seconds how long the measure lasts in seconds and then simply calculate when we are past the elapsed time in seconds and this is how we synchronize measures
             */
            while (elapsedMeasureTime < timeEndIndex) {
                if(TuneScope._ts_pausePlayback) break;
                const note = currTrack[measureIndex][0];
                const fullNoteLength = TuneScope.noteLengthToTimeValue(currTrack[measureIndex][1]);
                var noteLength = fullNoteLength;
                var restLength = 0

                if (currTrack[measureIndex][2]) {
                    newDuration = TuneScope.getArticulation(fullNoteLength, currTrack[measureIndex][2])
                    noteLength = newDuration.length;
                    restLength = newDuration.restLength;
                }

                measureIndex++; //increment for the next index in the track

                // play the note and wait
                await TuneScope.playNote(note, noteLength, instrument);
                await wait(fullNoteLength * 1000)

                // we increment i with respect to the number of beats the current note occupies in a measure
                elapsedMeasureTime += fullNoteLength;
            }

        }

        const playTracks = async (tracksList, timeSignature, tempo) => {
            // verify inputs
            if (!tracksList.contents) return;

            const beatsPerMeasure = TuneScope.timeSignatureToBeatsPerMeasure(timeSignature);

            var tracks = window.convertListToArrayRecursive(tracksList);

            // convert all elements in the track to lowercase
            tracks = window.toLowerCaseRecursive(tracks);

            // check to make sure we have an actual melody/chord track rather than just a loop
            // this ensures that we have a definitive track length
            let haveSetTrackLength = false
            let definitiveTrackIndex = 0 //index of valid melody/chord track

            // check to make sure we have an actual melody/chord track rather than just a loop
            // this ensures that we have a deinitive track length
            for (let i = 0; i < tracks.length; i++) {
                let currTrack = tracks[i];
                console.log(currTrack)
                if (currTrack[0][0] === "melody" || currTrack[0][0] === "chords") {
                    definitiveTrackIndex = i;
                    haveSetTrackLength = true;
                    break;
                }
            }


            if (!haveSetTrackLength) {
                throw new Error("No Melody or Chord track provided, only Chord/Drum Loop")
                return;
            }

            /*
                first, add up all the note values in the track
                to determine the total number of beats
                then, calculate the number of measures by considering the time signature
                and the total number of beats in the track list
            */

            // converts the strings of note length in each track to their respective duration values
            for (let i = 0; i < tracks.length; i++) {
                let currTrack = tracks[i];
                for (let j = 1; j < currTrack.length; j++) { //index from 1 to avoid the header
                    //Reassign the durations list to duration in seconds 
                    //jth (Note, Duration) pair
                    if (!window.isNumber(currTrack[j][1])) {
                        currTrack[j][1] = TuneScope.noteLengthToTimeValue(currTrack[j][1]) * (TuneScope.baseTempo / tempo);
                        console.log("the number is " + currTrack[j][1]);
                    } else {
                        currTrack[j][1] = parseFloat(currTrack[j][1]) * (TuneScope.baseTempo / tempo);
                        console.log("the number is " + currTrack[j][1]);
                    }
                }
            }

            var totalSeconds = 0.0;
            var defTrack = tracks[definitiveTrackIndex];
            for (let j = 1; j < defTrack.length; j++) {
                totalSeconds += defTrack[j][1];
            }
            const secondsPerMeasure = (TuneScope.baseTempo / tempo) * beatsPerMeasure[0]
            const totalMeasures = Math.ceil(totalSeconds / secondsPerMeasure)

            //convert any melody/chord/drum loop to a regular track
            // done by repeatedly appending the array to itself
            for (let i = 0; i < tracks.length; i++) {
                let currTrack = tracks[i];
                //check if the current track is a loop
                if (currTrack[0][0] === "loop-melody" || currTrack[0][0] === "loop-chords") {
                    let secondsInLoop = 0;
                    for (let j = 1; j < currTrack.length; j++) {
                        secondsInLoop += parseFloat(currTrack[j][1]);
                    }
                    let loopCount = parseInt(totalSeconds / secondsInLoop);

                    //appending the track to itself
                    //we don't repeat the header
                    let header = currTrack[0];
                    let newTrack = multiplyArray(currTrack.slice(1), loopCount);
                    newTrack.unshift(header)

                    if (header[0] === "loop-chords") {
                        newTrack[0][0] = "chords";
                    } else {
                        newTrack[0][0] = "melody";
                    }

                    //push the multiplied track to the tracks list
                    //and remove the original loop
                    tracks.push(newTrack)
                    tracks.splice(i,1)
                    i--;
                }
            }


            for (let i = 0; i < tracks.length; i++) {
                let currTrack = tracks[i];
                //find which elements of the track list are embedded chords
                if (currTrack[0][0] === "chords") {
                    let chordInstrument = currTrack[0][1];
                    let maxChordLen = 0;
                    for (let j = 1; j < currTrack.length; j++) {
                        // iterate through each chord in the track to find the largest chord (most # of notes)
                        maxChordLen = Math.max(maxChordLen, currTrack[j][0].length);
                    }
                    
                    //splits the notes of chords into separate tracks
                    for(let k = 0; k < maxChordLen; k++) {
                        // the new track will have the same instrument, but be encoded as a melody line
                        let newTrack = [["melody", chordInstrument]];
                        for (let j = 1; j < currTrack.length; j++) {
                            let currChord = currTrack[j][0];
                            // if the chord is large enough, add the kth note of the chord to the melody line
                            //otherwise, the melody will rest for that note in the track
                            if (k < currChord.length) {
                                // kth note of the chord, keep the duration of the chord
                                newTrack.push([currChord[k], currTrack[j][1]]);
                            }else {
                                newTrack.push(["r", currTrack[j][1]]);

                            }
                        }
                        //add this new track to the overarching tracklist
                        tracks.push(newTrack);
                    }
                    // delete original chord track from tracks
                    tracks.splice(i, 1);
                    i--;
                }
            }


            // Play Measures track by track
            for (let i = 0; i < totalMeasures; i++) {
                if(TuneScope._ts_pausePlayback) break;
                console.log("Playing measure " + (i + 1));
                const measureResults = [];

                // count for the number of beats that have passed since the last measure
                // e.g. in 4/4, measure 3 will have 2*4 = 8 beats elapsed. Next measure starts
                // on beat 8 (0 indexed)
                let elapsedTime = i * (TuneScope.baseTempo / tempo) * beatsPerMeasure[0];

                //per track
                for (let j = 0; j < tracks.length; j++) {
                    let currTrack = tracks[j];
                    let instrument = currTrack[0][1];
                    let measureIndex = 0;
                    let elapsedSum = 0;

                    // identifying where in the track array to begin the measure
                    // since different tracks have different array lengths, but
                    // the same amount of beats, they will align at each measure
                    // beat-wise, but have different starting indices measure-wise
                    for (let k = 1; k < currTrack.length; k++) {
                        if (elapsedSum >= elapsedTime) {
                            measureIndex = k;
                            break;
                        } else {
                            // add the value of the kth duration
                            elapsedSum += currTrack[k][1];
                        }
                    }

                    measureResults.push(new Promise((resolve, reject) => {
                        playTrackMeasure(currTrack, measureIndex, beatsPerMeasure, tempo, instrument).then(() => {
                            resolve();
                        }).catch((err) => {
                            reject(err);
                        })
                    }));
                }
                await Promise.all(measureResults);
            }
        }

        playTracks(tracksList, timeSignature, tempo);
    }
);
