		function askForFilenameAndLoad () {
			// Ask for a filename
			swal({
				title: "Enter a name",
				text: "Please enter your program's name:",
				type: "input",
				showCancelButton: true,
				closeOnConfirm: false,
				animation: "slide-from-top"
			}, (input) => {
				if (input === false) {
					return false;
				}

				if (input === "") {
					swal.showInputError("Please enter a name.");
					return false;
				}

				if (!files.exists(input)) {
					swal.showInputError("File does not exist.");
					return false;
				}

				currentFilename = input;

				swal.close();

				editor.value = files.read(currentFilename);
			});
		};