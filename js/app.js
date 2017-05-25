/**
 * Written by Tobias Sijtsma
 * GitHub @Tobiaqs
 */
"use strict";

(function () {
	window.cTMIDE = window.cTMIDE || {};

	if (!window.localStorage) {
		alert("No localStorage support. This app will not work.");
		return;
	}

	if (!window.localStorage.cTMIDEFolder) {
		window.localStorage.cTMIDEFolder = "{}";
	}

	// Allows for "file" storage in localStorage
	let files = {
		write: (filename, content) => {
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
	let activeViewName;

	// Declare DOM element holders
	let editor;
	let browse;
	let toolbarBtnEditor;
	let toolbarBtnNew;
	let toolbarBtnBrowse;
	let toolbarBtnSave;
	let toolbarBtnEmulator;
	let toolbarBtnTest;
	let toolbarBtnValidate;

	// The cTM instance used by the emulator

	// Emulator variables
	let emulatorCTM = new cTMIDE.cTM;
	let emulatorSteps;
	let emulatorInput;
	let emulatorError;
	let emulatorStats;
	let emulatorTape;
	let emulatorBtnStep;
	let emulatorBtnRun;
	let emulatorBtnRestart;

	// Test variables
	let testCTM = new cTMIDE.cTM;
	let testInput;
	let testExpectedOutput;
	let testType;
	let testBtnAdd;
	let testCases;
	let testFields;
	let testBtnRunAll;
	let testPrefix = "%% cTMIDE-TestCases: ";

	let hints = {
		testType: {
			title: "Test type",
			text: "When set to Exact match, the test will run successfully iff the tape contains only the expected output.\n\n" +
				"When set to Substring, the test will run successfully iff the expected output is a substring of the tape."
		}
	};

	let views = {
		browse: {
			onEnter: () => {
				// Create links
				let links = "";
				files.list().forEach((file) => {
					links += "<div class=\"browse-file\"><div class=\"browse-file-title\">" + file + "</div><div class=\"browse-file-controls\"><a href=\"javascript:void(0);\" data-open-file=\"" + file + "\">load</a><a href=\"javascript:void(0);\" data-delete-file=\"" + file + "\">delete</a></div></div>";
				});
				browse.innerHTML = links;

				if (browse.innerHTML === "") {
					browse.innerHTML = "No files were found!";
				}

				// Add listeners to the links
				[].forEach.call(browse.getElementsByTagName("A"), (node) => {
					if (node.attributes["data-open-file"]) {
						node.addEventListener("click", () => {
							editorLoadProgram(node.attributes["data-open-file"].value);
						});
					} else if (node.attributes["data-delete-file"]) {
						node.addEventListener("click", () => {
							editorRemoveProgram(node.attributes["data-delete-file"].value);
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
				views.emulator.onLeave();
			},
			// This method is kind of being abused by other methods
			// that shouldn't be touching it. Oh well =)
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
		},

		test: {
			onEnter: () => {
				if (!currentFilename) {
					swal("No program opened", "No program is currently opened. Please open a program or save your current work, and then return.", "error");
					setActiveView("editor");
					return;
				}

				if (!editorIsProgramPristine()) {
					swal("Changes not saved", "Please save your changes prior to opening the test case editor.", "error");
					setActiveView("editor");
					return;
				}

				testUpdateCases();
			},
			onLeave: () => {
				testFields.classList.remove("hidden");
				testCases.innerHTML = "";
			}
		}
	};

	window.addEventListener("load", () => {
		// Get elements from DOM
		editor = document.getElementsByClassName("editor")[0];
		browse = document.getElementsByClassName("browse")[0];
		toolbarBtnEditor = document.getElementsByClassName("toolbar-btn-editor")[0];
		toolbarBtnNew = document.getElementsByClassName("toolbar-btn-new")[0];
		toolbarBtnBrowse = document.getElementsByClassName("toolbar-btn-browse")[0];
		toolbarBtnSave = document.getElementsByClassName("toolbar-btn-save")[0];
		toolbarBtnEmulator = document.getElementsByClassName("toolbar-btn-emulator")[0];
		toolbarBtnTest = document.getElementsByClassName("toolbar-btn-test")[0];
		toolbarBtnValidate = document.getElementsByClassName("toolbar-btn-validate")[0];

		emulatorInput = document.getElementsByClassName("emulator-input")[0];
		emulatorError = document.getElementsByClassName("emulator-error")[0];
		emulatorStats = document.getElementsByClassName("emulator-stats")[0];
		emulatorTape = document.getElementsByClassName("emulator-tape")[0];
		emulatorBtnStep = document.getElementsByClassName("emulator-btn-step")[0];
		emulatorBtnRun = document.getElementsByClassName("emulator-btn-run")[0];
		emulatorBtnRestart = document.getElementsByClassName("emulator-btn-restart")[0];

		testInput = document.getElementsByClassName("test-input")[0];
		testExpectedOutput = document.getElementsByClassName("test-expected-output")[0];
		testType = document.getElementsByClassName("test-type")[0];
		testBtnAdd = document.getElementsByClassName("test-btn-add")[0];
		testCases = document.getElementsByClassName("test-cases")[0];
		testFields = document.getElementsByClassName("test-fields")[0];
		testBtnRunAll = document.getElementsByClassName("test-btn-run-all")[0];

		// Bind listeners
		toolbarBtnNew.addEventListener("click", editorNewProgram);

		toolbarBtnBrowse.addEventListener("click", () => {
			setActiveView("browse");
		});

		toolbarBtnSave.addEventListener("click", () => {
			if (currentFilename) {
				files.write(currentFilename, editor.value);
			} else {
				editorSaveProgramAs();
			}
		});

		toolbarBtnEmulator.addEventListener("click", () => {
			setActiveView("emulator");
		});

		toolbarBtnEditor.addEventListener("click", () => {
			setActiveView("editor");
		});

		toolbarBtnTest.addEventListener("click", () => {
			setActiveView("test");
		});

		// Emulator listeners

		emulatorInput.addEventListener("keyup", emulatorOnInputChanged);

		emulatorBtnStep.addEventListener("click", () => {
			// If no error, add to the step counter
			let error = emulatorCTM.step();
			if (!error) {
				emulatorSteps ++;
			} else {
				emulatorError.innerHTML = error;

				emulatorBtnStep.disabled = true;
				emulatorBtnRun.disabled = true;
			}

			if (emulatorCTM.isFinished()) {
				emulatorBtnStep.disabled = true;
				emulatorBtnRun.disabled = true;
			}

			emulatorUpdateTapeRepresentation();
			emulatorUpdateStats();
		});

		emulatorBtnRun.addEventListener("click", () => {
			// Run until finished
			while (!emulatorCTM.isFinished()) {
				// Or: until an error occurs
				let error = emulatorCTM.step()
				if (!error) {
					emulatorSteps ++;
				} else {
					emulatorError.innerHTML = error;

					emulatorBtnStep.disabled = true;
					emulatorBtnRun.disabled = true;
					break;
				}
			}

			if (emulatorCTM.isFinished()) {
				emulatorBtnStep.disabled = true;
				emulatorBtnRun.disabled = true;
			}

			emulatorUpdateTapeRepresentation();
			emulatorUpdateStats();
		});

		emulatorBtnRestart.addEventListener("click", () => {
			emulatorOnInputChanged();
		});

		// Test listeners

		testBtnAdd.addEventListener("click", () => {
			if (testInput.value.trim().length !== 0 && testExpectedOutput.value.trim().length !== 0) {
				testAddCase(testInput.value.trim(), testExpectedOutput.value.trim(), testType.value);
			} else {
				swal("Validation error", "Please enter an input and an expected output.", "error");
			}
		});

		testBtnRunAll.addEventListener("click", () => {
			testRunAllCases();
		});

		// Hints

		[].forEach.call(document.getElementsByClassName("hint"), (hintNode) => {
			hintNode.addEventListener("click", () => {
				let hint = hints[hintNode.attributes["data-hint-id"].value];
				swal(hint.title, hint.text, "info");
			});
		});

		setActiveView("editor");
	});

	// Functions for EDITOR view

	// Show a popup asking for a filename, then set currentFilename and click save button. 
	function editorSaveProgramAs () {
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
	function editorNewProgram () {
		// Two cases in which creating a new file is allowed without confirmation
		if (editorIsProgramPristine()) {
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
	function editorLoadProgram (filename) {
		// Two cases in which loading a file is allowed without confirmation
		if (editorIsProgramPristine()) {
			currentFilename = filename;
			editor.value = files.read(filename);
			setActiveView("editor");
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
			setActiveView("editor");
			swal.close();
		});
	};

	// From browse: remove a program
	function editorRemoveProgram (filename) {
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
			views.browse.onEnter();
		});
	};

	// Is current file saved or does not need to be saved
	function editorIsProgramPristine () {
		return (currentFilename && files.exists(currentFilename) && files.read(currentFilename) === editor.value) || (!currentFilename && editor.value.length === 0);
	};

	// Functions for EMULATOR view

	// Simple handler for the emulator
	function emulatorOnInputChanged () {
		// Reset everything but keep input
		views.emulator.onLeave(true);

		let errors = emulatorCTM.initialize(editor.value, emulatorInput.value.split(""));

		if (errors) {
			emulatorError.innerHTML = errors.join("<br>");
			emulatorBtnStep.disabled = true;
			emulatorBtnRun.disabled = true;
		} else {
			emulatorBtnStep.disabled = false;
			emulatorBtnRun.disabled = false;

			emulatorUpdateTapeRepresentation();
			emulatorUpdateStats();
		}
	};

	// In emulator: update the representation of the tape
	function emulatorUpdateTapeRepresentation () {
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
	function emulatorUpdateStats () {
		emulatorStats.innerHTML = "Transitions taken: " + emulatorSteps + "<br>" +
			"Current state: " + emulatorCTM.state;
	};

	// Functions for TEST

	function testUpdateCases () {
		let cases = testGetCases();

		if (!cases || cases.length === 0) {
			testBtnRunAll.classList.add("hidden");
			
			testCases.innerHTML = "No test cases found.";
		} else {
			testBtnRunAll.classList.remove("hidden");

			let html = "<table><tr><td>Input</td><td>Expected output</td><td>Type</td><td></td><td></td></tr>";
			cases.forEach((_case, index) => {
				let typeName = [].find.call(testType.children, (node) => node.value === _case.type).innerHTML;
				html += "<tr><td>" + _case.input + "</td><td>" + _case.expectedOutput + "</td><td>" + typeName + "</td><td><a href=\"javascript:void(0);\" data-run-case=\"" + index + "\">Run</a></td><td><a href=\"javascript:void(0);\" data-delete-case=\"" + index + "\">Delete</a></td></tr>";
			});

			testCases.innerHTML = html;

			[].forEach.call(testCases.getElementsByTagName("A"), (node) => {
				node.addEventListener("click", () => {
					if (node.attributes["data-delete-case"]) {
						testDeleteCase(node.attributes["data-delete-case"].value * 1);
					} else if (node.attributes["data-run-case"]) {
						testRunCase(node.attributes["data-run-case"].value * 1);
					}
				});
			});
		}
	};

	function testGetCases () {
		let content = files.read(currentFilename);
		let firstLine = content.split("\n").find((line) => line.length !== 0);

		if (firstLine) {
			let firstLineTrimmed = firstLine.trim();

			let indexOfPrefix = firstLineTrimmed.indexOf(testPrefix);

			if (indexOfPrefix === 0) {
				let cases = JSON.parse(firstLineTrimmed.substr(testPrefix.length));
				return cases;
			}
		}
	};

	function testDeleteCase (index) {
		let content = files.read(currentFilename);
		let firstLine = content.split("\n").find((line) => line.length !== 0);

		if (firstLine) {
			let firstLineTrimmed = firstLine.trim();

			let indexOfPrefix = firstLineTrimmed.indexOf(testPrefix);

			if (indexOfPrefix === 0) {
				let cases = JSON.parse(firstLineTrimmed.substr(testPrefix.length));
				cases.splice(index, 1);
				if (cases.length !== 0) {
					let json = JSON.stringify(cases);
					content = content.replace(firstLineTrimmed, testPrefix + json);
				} else {
					if (content.indexOf(firstLine + "\n") !== -1) {
						content = content.replace(firstLine + "\n", "");
					} else {
						content = content.replace(firstLine, "");
					}
				}
				files.write(currentFilename, content);
				editor.value = content;
				testUpdateCases();
			}
		}
	};

	function testAddCase (input, expectedOutput, type) {
		let _case = {
			input: input,
			expectedOutput: expectedOutput,
			type: type
		};

		let content = files.read(currentFilename);
		let firstLine = content.split("\n").find((line) => line.length !== 0);

		if (firstLine) {
			let firstLineTrimmed = firstLine.trim();

			let indexOfPrefix = firstLineTrimmed.indexOf(testPrefix);

			if (indexOfPrefix === 0) {
				let cases = JSON.parse(firstLineTrimmed.substr(testPrefix.length));
				cases.push(_case);
				if (cases.length !== 0) {
					let json = JSON.stringify(cases);
					content = content.replace(firstLineTrimmed, testPrefix + json);
				}
				files.write(currentFilename, content);
				editor.value = content;
				testUpdateCases();
				return;
			}
		}

		let json = JSON.stringify([_case]);
		content = testPrefix + json + "\n\n" + content;

		files.write(currentFilename, content);
		editor.value = content;
		testUpdateCases();
	};

	function testRunCaseInternal (content, _case) {
		testCTM.reset();
		testCTM.initialize(content, _case.input.split(""));
		let error;

		let stepCounter = 0;
		while (!testCTM.isFinished()) {
			error = testCTM.step();
			if (error) {
				break;
			}
			stepCounter ++;
		}

		if (error) {
			return { type: "error", title: "Test run failed", text: "The reported error was:\n\n" + error };
		}

		let data = testCTM.tape.getData();

		// Trim #s
		while (data[0] === "#") {
			data.splice(0, 1);
		}

		while (data[data.length - 1] === "#") {
			data.splice(data.length - 1, 1);
		}

		if ((_case.type === "substring" && data.join("").indexOf(_case.expectedOutput) !== -1) || (_case.type === "exact" && _case.expectedOutput === data.join(""))) {
			return { type: "success", title: "Test run succeeded!", text: "The test run succeeded with " + stepCounter + " transitions taken." };
		} else {
			return { type: "error", title: "Test run failed!", text: "The test run failed because of an output mismatch." };
		}
	};

	function testRunCase (index) {
		let program = files.read(currentFilename);

		let cases = testGetCases();
		let _case = cases[index];

		let result = testRunCaseInternal(program, _case);

		swal(result.title, result.text, result.type);
	};

	function testRunAllCases () {
		let program = files.read(currentFilename);

		let cases = testGetCases();

		let results = [];
		let success = 0;
		let fail = 0;
		cases.forEach((_case) => {
			let result = testRunCaseInternal(program, _case);
			if (result.type === "error") {
				fail ++;
			} else if (result.type === "success") {
				success ++;
			}
			results.push(result);
		});

		let textualResults = results.map((result, index) => "Test " + (index + 1) + " " + (result.type === "success" ? "passed" : "failed") + ". " + result.text).join("\n\n");

		let description = "The results of all tests are summarized below."
		if (success === 0) {
			swal("All test runs failed", "All test runs failed. " + description + "\n\n" + textualResults);
		} else if (fail !== 0) {
			swal("Some test runs failed", "Some test runs failed. " + description + "\n\n" + textualResults);
		} else if (fail === 0) {
			swal("All tests passed!", "All test runs passed! " + description + "\n\n" + textualResults);
		}
	};

	// GENERAL functions

	function setActiveView (viewName) {
		// Don't do anything if not required
		if (viewName === activeViewName) {
			return;
		}

		// Run onLeave listener
		if (activeViewName && views[activeViewName]) {
			views[activeViewName].onLeave();
		}

		activeViewName = viewName;

		let viewNodes = document.getElementsByClassName("view");
		[].forEach.call(viewNodes, (viewNode) => {
			if (viewNode.classList.contains("view-" + activeViewName)) {
				viewNode.classList.add("visible");
			} else {
				viewNode.classList.remove("visible");
			}
		});

		let viewBtnNodes = document.getElementsByClassName("toolbar-btn-view");

		[].forEach.call(viewBtnNodes, (viewBtnNode) => {
			if (viewBtnNode.classList.contains("toolbar-btn-" + activeViewName)) {
				viewBtnNode.classList.remove("visible");
			} else {
				viewBtnNode.classList.add("visible");
			}
		});

		// Hide file manipulation buttons when not in the editor state
		let iconBtnNodes = document.getElementsByClassName("toolbar-btn-icon");

		[].forEach.call(iconBtnNodes, (iconBtnNode) => {
			if (activeViewName === "editor") {
				iconBtnNode.classList.remove("hidden");
			} else {
				iconBtnNode.classList.add("hidden");
			}
		});

		// Run onEnter listener
		if (views[viewName]) {
			views[viewName].onEnter();
		}
	};
})();
