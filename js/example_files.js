/**
 * Written by Tobias Sijtsma
 * GitHub @Tobiaqs
 */
"use strict";

(function () {
	window.cTMIDE = window.cTMIDE || {};

	cTMIDE.exampleFiles = {
		"example-1": "%% cTMIDE-TestCases: [{"input":"aaaaaaaaaaa","expectedOutput":"bbbbbbbbbbb","type":"exact"},{"input":"abababababab","expectedOutput":"babababababa","type":"exact"}]\n\n%% cTM program computing the complement of a string\n%% {a,b}* -> {a,b}*\n\n%% start on left most symbol\n\n%% scan to right end\n%% replacing a by b, b by a\nq0 a/b,R q0\nq0 b/a,R q0\n\n%% scan to left end if blank is found\n%% leaving all letters as is\nq0 #/#,L q1\nq1 a/a,L q1\nq1 b/b,L q1\n\n%% halt if left end is reached\n%% position tape head on left most symbol\nq1 #/#,R q2",
		"example-2": "%% cTMIDE-TestCases: [{"input":"aaaaaaaa","expectedOutput":"abababab","type":"exact"},{"input":"bbbbbbbb","expectedOutput":"abababab","type":"exact"},{"input":"aaaaa","expectedOutput":"ababa","type":"exact"},{"input":"bbbbb","expectedOutput":"ababa","type":"exact"}]\n\n%% cTM program patching the pattern ab\n%% {a,b}* -> {a,b}*\n\n%% at odd positions overwrite with a\nq0 a/a,R q1\nq0 b/a,R q1\n\n%% at even positions overwrite with b\nq1 a/b,R q0\nq1 b/b,R q0\n\n%% at end of string change direction\nq0 #/#,L q2\nq1 #/#,L q2\n%% move to leftmost symbol\nq2 a/a,L q2\nq2 b/b,L q2\nq2 #/#,R q3"
	};
})();