/**
 * Written by Tobias Sijtsma
 * GitHub @Tobiaqs
 */
"use strict";

(function () {
	window.cTMIDE = window.cTMIDE || {};

	if (!window.localStorage) {
		alert("No localStorage support");
		return;
	}

	if (!window.localStorage.cTMIDEFolder) {
		window.localStorage.cTMIDEFolder = "{}";
	}

	// Allows for "file" storage in localStorage
	let files = {
		save: (filename, content) => {
			let folder = JSON.parse(window.localStorage.cTMIDEFolder);
			folder[filename] = content;
			window.localStorage.cTMIDEFolder = JSON.stringify(folder);
		},
		read: (filename) => {
			let folder = JSON.parse(window.localStorage.cTMIDEFolder);
			return folder[filename];
		},
		delete: (filename) => {
			let folder = JSON.parse(window.localStorage.cTMIDEFolder);
			delete folder[filename];
			window.localStorage.cTMIDEFolder = JSON.stringify(folder);
		},
		exists: (filename) => {
			let folder = JSON.parse(window.localStorage.cTMIDEFolder);
			return !!folder[filename];
		},
		list: () => {
			let folder = JSON.parse(window.localStorage.cTMIDEFolder);
			return Object.keys(folder);
		}
	};

	// Declare state variables
	let currentFilename;
	let activeWrapperName;

	// Declare DOM element holders
	let editor;
	let browse;
	let toolbarBtnBack;
	let toolbarBtnNew;
	let toolbarBtnBrowse;
	let toolbarBtnSave;
	let toolbarBtnEmulate;
	let toolbarBtnTest;
	let toolbarBtnValidate;

	// The cTM instance used by the emulator
	let emulatorCTM = new cTMIDE.cTM;
	let emulatorSteps;
	let emulatorInput;
	let emulatorError;
	let emulatorStats;
	let emulatorTape;
	let emulatorBtnStep;
	let emulatorBtnRun;
	let emulatorBtnRestart;

	let wrappers = {
		browse: {
			onEnter: () => {
				// Create links
				let links = [];
				files.list().forEach((file) => {
					links.push("<a href=\"javascript:void(0);\" data-open-file=\"" + file + "\">Load " + file + "</a> (<a href=\"javascript:void(0);\" data-delete-file=\"" + file + "\">delete</a>)");
				});
				browse.innerHTML = links.join("<br>");

				if (browse.innerHTML === "") {
					browse.innerHTML = "No files were found!";
				}

				// Add listeners to the links
				[].forEach.call(browse.getElementsByTagName("A"), (node) => {
					if (node.attributes["data-open-file"]) {
						node.addEventListener("click", () => {
							loadProgram(node.attributes["data-open-file"].value);
						});
					} else if (node.attributes["data-delete-file"]) {
						node.addEventListener("click", () => {
							removeProgram(node.attributes["data-delete-file"].value);
						});
					}
				});
			},
			onLeave: () => {
				browse.innerHTML = "";
			}
		},

		emulator: {
			onEnter: () => {
				wrappers.emulator.onLeave();
			},
			onLeave: (leaveInput) => {
				emulatorCTM.reset();

				if (!leaveInput) {
					emulatorInput.value = "";
				}

				emulatorBtnStep.disabled = true;
				emulatorBtnRun.disabled = true;
				emulatorError.innerHTML = "";
				emulatorTape.innerHTML = "";
				emulatorStats.innerHTML = "";
				emulatorSteps = 0;
			}
		}
	};

	window.addEventListener("load", () => {
		// Get elements from DOM
		editor = document.getElementsByClassName("editor")[0];
		browse = document.getElementsByClassName("browse")[0];
		toolbarBtnBack = document.getElementsByClassName("toolbar-btn-back")[0];
		toolbarBtnNew = document.getElementsByClassName("toolbar-btn-new")[0];
		toolbarBtnBrowse = document.getElementsByClassName("toolbar-btn-browse")[0];
		toolbarBtnSave = document.getElementsByClassName("toolbar-btn-save")[0];
		toolbarBtnEmulate = document.getElementsByClassName("toolbar-btn-emulate")[0];
		toolbarBtnTest = document.getElementsByClassName("toolbar-btn-test")[0];
		toolbarBtnValidate = document.getElementsByClassName("toolbar-btn-validate")[0];

		emulatorInput = document.getElementsByClassName("emulator-input")[0];
		emulatorError = document.getElementsByClassName("emulator-error")[0];
		emulatorStats = document.getElementsByClassName("emulator-stats")[0];
		emulatorTape = document.getElementsByClassName("emulator-tape")[0];
		emulatorBtnStep = document.getElementsByClassName("emulator-btn-step")[0];
		emulatorBtnRun = document.getElementsByClassName("emulator-btn-run")[0];
		emulatorBtnRestart = document.getElementsByClassName("emulator-btn-restart")[0];

		// Bind listeners
		toolbarBtnNew.addEventListener("click", newProgram);

		toolbarBtnBrowse.addEventListener("click", () => {
			setActiveWrapper("browse");
		});

		toolbarBtnSave.addEventListener("click", () => {

			if (currentFilename) {
				files.save(currentFilename, editor.value);
			} else {
				saveProgramAs();
			}
		});

		toolbarBtnEmulate.addEventListener("click", () => {
			setActiveWrapper("emulator");
		});

		toolbarBtnBack.addEventListener("click", () => {
			setActiveWrapper("editor");
		});

		emulatorInput.addEventListener("keyup", onEmulatorInputChanged);

		emulatorBtnStep.addEventListener("click", () => {
			// If no error, add to the step counter
			if (emulatorCTM.step()) {
				emulatorSteps ++;
			}

			if (emulatorCTM.isFinished()) {
				emulatorBtnStep.disabled = true;
				emulatorBtnRun.disabled = true;
			}

			updateTapeRepresentation();
			updateStats();
		});

		emulatorBtnRun.addEventListener("click", () => {
			// Run until finished
			while (!emulatorCTM.isFinished()) {
				// Or: until an error occurs
				if (!emulatorCTM.step()) {
					break;
				}
				emulatorSteps ++;
			}

			if (emulatorCTM.isFinished()) {
				emulatorBtnStep.disabled = true;
				emulatorBtnRun.disabled = true;
			}

			updateTapeRepresentation();
			updateStats();
		});

		emulatorBtnRestart.addEventListener("click", () => {
			onEmulatorInputChanged();
		});

		emulatorCTM.on("error", (error) => {
			emulatorError.innerHTML = error;
		});

		setActiveWrapper("editor");
	});

	// Functions

	// Simple handler for the emulator
	function onEmulatorInputChanged () {
		// Reset everything but keep input
		wrappers.emulator.onLeave(true);
		emulatorCTM.initialize(editor.value, emulatorInput.value.split(""));

		emulatorBtnStep.disabled = false;
		emulatorBtnRun.disabled = false;

		updateTapeRepresentation();
		updateStats();
	};

	// Show a popup asking for a filename, then set currentFilename and click save button. 
	function saveProgramAs () {
		swal({
			title: "Enter a name",
			text: "Please give your program a name:",
			type: "input",
			showCancelButton: true,
			closeOnConfirm: false,
			animation: "slide-from-top",
			inputPlaceholder: "No extension required!"
		}, (input) => {
			if (input === false) {
				return false;
			}

			if (input === "") {
				swal.showInputError("Please enter a name.");
				return false;
			}

			if (!/^[A-Za-z0-9\-_ \.\,]+$/.test(input)) {
				swal.showInputError("This name is not allowed.");
				return false;
			}

			if (files.exists(input)) {
				swal.showInputError("A program with this name already exists.");
				return false;
			}

			currentFilename = input;

			swal.close();

			toolbarBtnSave.click();
		});
	};

	// New button clicked.
	function newProgram () {
		// Two cases in which creating a new file is allowed without confirmation
		if (isProgramPristine()) {
			currentFilename = null;
			editor.value = "";
			return;
		}

		// Otherwise, ask the user if they are sure
		swal({
			title: "Are you sure?",
			text: "Your unsaved changes will be lost.",
			type: "warning",
			showCancelButton: true,
			confirmButtonColor: "#DD6B55",
			confirmButtonText: "Yes, new file!",
			closeOnConfirm: false
		}, () => {
			currentFilename = null;
			editor.value = "";
			swal.close();
		});
	};

	// From browse: load a program
	function loadProgram (filename) {
		// Two cases in which loading a file is allowed without confirmation
		if (isProgramPristine()) {
			currentFilename = filename;
			editor.value = files.read(filename);
			setActiveWrapper("editor");
			return;
		}

		// Otherwise, ask the user if they are sure
		swal({
			title: "Are you sure?",
			text: "Your unsaved changes will be lost.",
			type: "warning",
			showCancelButton: true,
			confirmButtonColor: "#DD6B55",
			confirmButtonText: "Yes, load file!",
			closeOnConfirm: false
		}, () => {
			currentFilename = filename;
			editor.value = files.read(filename);
			setActiveWrapper("editor");
			swal.close();
		});
	};

	// From browse: remove a program
	function removeProgram (filename) {
		// Ask the user if they are sure
		swal({
			title: "Are you sure?",
			text: "This file will be deleted.",
			type: "warning",
			showCancelButton: true,
			confirmButtonColor: "#DD6B55",
			confirmButtonText: "Yes, delete file!",
			closeOnConfirm: false
		}, () => {
			// Delete the file
			files.delete(filename);

			// If the deleted file was loaded, clear out editor
			if (filename === currentFilename) {
				editor.value = "";
				currentFilename = null;
			}

			swal.close();

			// Update list
			wrappers.browse.onEnter();
		});
	};

	// Is current file saved or does not need to be saved
	function isProgramPristine () {
		return (currentFilename && files.exists(currentFilename) && files.read(currentFilename) === editor.value) || (!currentFilename && editor.value.length === 0);
	}

	function setActiveWrapper (wrapperName) {
		// Don't do anything if not required
		if (wrapperName === activeWrapperName) {
			return;
		}

		// Run onLeave listener
		if (activeWrapperName && wrappers[activeWrapperName]) {
			wrappers[activeWrapperName].onLeave();
		}

		let wrapperNodes = document.getElementsByClassName("wrapper");
		[].forEach.call(wrapperNodes, (wrapperNode) => {
			if (wrapperNode.classList.contains("wrapper-" + wrapperName)) {
				wrapperNode.classList.add("visible");
			} else {
				wrapperNode.classList.remove("visible");
			}
		});

		activeWrapperName = wrapperName;

		if (wrapperName !== "editor") {
			// Show back, hide file manipulation buttons
			toolbarBtnBack.classList.remove("hidden");
			toolbarBtnNew.classList.add("hidden");
			toolbarBtnBrowse.classList.add("hidden");
			toolbarBtnSave.classList.add("hidden");
		} else {
			// Hide back, show file manipulation buttons
			toolbarBtnBack.classList.add("hidden");
			toolbarBtnNew.classList.remove("hidden");
			toolbarBtnBrowse.classList.remove("hidden");
			toolbarBtnSave.classList.remove("hidden");
		}

		// Run onEnter listener
		if (wrappers[wrapperName]) {
			wrappers[wrapperName].onEnter();
		}
	};

	// In emulator: update the representation of the tape
	function updateTapeRepresentation () {
		let data = emulatorCTM.tape.getData();
		let position = emulatorCTM.tape.getPosition();
		let blank = "<div class=\"emulator-tape-element\">#</div>";
		let blankSelected = "<div class=\"emulator-tape-element selected\">#</div>";
		let centerHTML = "";

		data.forEach((element, index) => {
			centerHTML += "<div class=\"emulator-tape-element" + (index === position ? " selected" : "") + "\">" + element + "</div>";
		});

		emulatorTape.innerHTML = "";

		if (position < 0) {
			emulatorTape.innerHTML += blankSelected;
			for (let i = 0; i < -position - 1; i ++) {
				emulatorTape.innerHTML += blank;
			}
			emulatorTape.innerHTML += centerHTML;

			if (data[data.length - 1] !== "#") {
				emulatorTape.innerHTML += blank;
			}
		} else if (position >= 0 && position < data.length) {
			if (data[0] !== "#") {
				emulatorTape.innerHTML += blank;
			}

			emulatorTape.innerHTML += centerHTML;

			if (data[data.length - 1] !== "#") {
				emulatorTape.innerHTML += blank;
			}
		} else if (position >= data.length) {
			if (data[0] !== "#") {
				emulatorTape.innerHTML += blank;
			}

			emulatorTape.innerHTML += centerHTML;

			for (let i = 0; i < position - data.length; i ++) {
				emulatorTape.innerHTML += blank;
			}

			emulatorTape.innerHTML += blankSelected;
		}
	};

	// In emulator: update statistics
	function updateStats () {
		emulatorStats.innerHTML = "Steps: " + emulatorSteps + "<br>" +
			"State: " + emulatorCTM.state;
	};
})();
