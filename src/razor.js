
// markup mode:
	// found @
		// is email address?
			//keep going
		// not email address?
			// is followed by @?
				// keep going, ignore one @
			// is followed by { ?
				// consume until matching } as JS
			// is followed by keyword?
				// switch to JS block mode
			// is followed by valid identifier?
				// switch to implicit expression mode

// JS block mode:
	// found @
		// is followed by @?
			// keep going, ignore one @
		// not followed by @?
			// switch to markup mode
	// found < ?
		// is followed by / or [a-zA-Z] ?
			// switch to markup mode
		// is not followed by [\/a-zA-Z] ?
			// keep going
	// may need rules for @: here and newlines
		
// JS implicit expression mode:
	// read single "word" (identifier)
	// A: is the next character a ( or [ ?
		// read matching, and go to A
	// not A: continue
	// is the next character a . ?
		// continue
	// not .:
		// end expression, switch to markup mode
	// is the character after . a valid start char for identifier?
		// read the ., go to start of implicit mode
	// not valid start:
		// end expression without including .
		// switch to markup mode
		

(function(root){
	

// taken from : http://urazor.com/Scripts/uRazor-classes.js
var TKS = {
    AT:     		/@/,
    PARENSTART:    	/\(/,
    PARENEND:      	/\)/,
    //COLON:      	/:/,
    BRACESTART:    	/\{/,
    BRACEEND:      	/\}/, 
    LT:         	/</,
    //GT:         	/>/,
    HARDPARENSTART:	/\[/,
    HARDPARENEND:  	/\]/,
	PERIOD: 		/\./,
	LBBRACEEND: 	/[\n\r]{1,}[^\S\r\n]*\}$/, // newline + optional whitespace + BRACEEND
	TAGOC: 			/\/|[a-zA-Z]/, // tag open or close, minus <
	EMAILCHARS: 	/[a-zA-Z0-9\!\#\$\%\&\'\*\+\-\/\=\?\^\_\`\{\|\}\~]/,
	IDENTIFIER: /^[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*/, // this could be simplifed to not support unicode
	RESERVED: /^abstract|as|boolean|break|byte|case|catch|char|class|continue|const|debugger|default|delete|do|double|else|enum|export|extends|false|final|finally|float|for|function|goto|if|implements|import|in|instanceof|int|interface|is|long|namespace|native|new|null|package|private|protected|public|return|short|static|super|switch|synchronized|this|throw|throws|transient|true|try|typeof|use|var|void|volatile|while|with/,
	
	// these are used for template generation, not parsing
    QUOTE:      	/[\"']/gi,
	LINEBREAK:  	/[\n\r]/gi
};


// markup, js block, implicit js expression
var modes = { MKP: "MARKUP", BLK: "BLOCK", EXP: "EXPRESSION" };

function parse(str){

	// current mode
	var mode = modes.MKP, modeStack = [modes.MKP];

	var markupBuffer = '', codeBuffer = '', buffers = [];

	// characters
	var prev, curr, next, i, j;

	var identifier = '', identifierMatch = null, groupLevel = 0;

	var codeNestLevel = 0;

	for(i = 0; i < str.length; i++){
		if(i > 0) prev = str[i-1];
		curr = str[i];
		if(i < str.length - 1) next = str[i+1];
	
		if(mode === modes.MKP){
			// current character is @
			if(TKS.AT.test(curr) === true){
				if(TKS.EMAILCHARS.test(prev) === true){
					// assume it's an e-mail address and continue
					markupBuffer += curr;
				} else {
					if(TKS.AT.test(next) === true){
						// escaped @. continue, but ignore one @
						markupBuffer += curr;
						i += 1; // skip next @
					} else if(TKS.BRACESTART.test(next) === true){
						// found {, enter block mode
						buffers.push( { type: modes.MKP, value: markupBuffer } );
						markupBuffer = ''; // blank out markup buffer;
						codeBuffer = ''; // blank out just in case
						codeNestLevel += 1;
						mode = modes.BLK;
						continue;
					} else if(TKS.PARENSTART.test(next) === true){
					
						// consume until next matched ) as mode.EXP, enter markup mode
						buffers.push( { type: modes.MKP, value: markupBuffer } );
						markupBuffer = ''; // blank out markup buffer;
						codeBuffer = ''; // blank out just in case					
						j = i+2; // j is index of char after (
						
						groupLevel = 1;
						while( groupLevel > 0 ){
							j += 1;
							curr = str[j];
							if(j < str.length - 1) next = str[j+1];

							if(TKS.PARENSTART.test(curr) === true) groupLevel += 1;
							if(TKS.PARENEND.test(curr) === true) groupLevel -= 1;

							if(j >= str.length) throw new Error('Syntax Error, unmatched PARENSTART');
						}
						
						// add ( something something (something something) ) to codeBuffer, without @
						codeBuffer += str.substring(i+1, j+1);

						buffers.push( { type: modes.EXP, value: codeBuffer } );
						markupBuffer = '';
						codeBuffer = ''; // blank out 
						mode = modes.MKP;

						i = j; // advance i to current char
						continue;
						
					} else {
						// test for identifier
						identifier = str.substring(i+1); // everything after @
						identifierMatch = identifier.match( TKS.IDENTIFIER );
					
						if(identifierMatch === null){
							// stay in content mode?
							markupBuffer += curr;
						} else {
							// found either a reserved word or a valid JS identifier
						
							if(TKS.RESERVED.test(identifierMatch[0]) === true){
								// found a reserved word, like while
								// switch to JS Block mode
								buffers.push( { type: modes.MKP, value: markupBuffer } );
								markupBuffer = ''; // blank out markup buffer;
								codeBuffer = identifierMatch[0];
								mode = modes.BLK;
								codeNestLevel += 1;
								i += codeBuffer.length; // skip identifier and continue in block mode
								continue;
							} else {
								// we have a valid identifier
								// switch to implicit expression mode: @myvar().dosomethingelse().prop
								buffers.push( { type: modes.MKP, value: markupBuffer } );
								markupBuffer = ''; // blank out markup buffer;
								codeBuffer = ''; // blank out just in case
								mode = modes.EXP;
								continue;
							}
						}
					}
				}
			} else if(TKS.BRACEEND.test(curr) === true) {
				// found } in markup mode, 
				
				identifier = str.substring(0, i+1); // grab from beginning, including }
				identifierMatch = identifier.match(TKS.LBBRACEEND);
				
				if(identifierMatch == null){
					// just a content }, nothing to worry about
					markupBuffer += curr;
				} else {
					// is a } on a new line, assume it's code related to close a block
					buffers.push( { type: modes.MKP, value: markupBuffer } );
					markupBuffer = ''; // blank out markup buffer;

					codeBuffer = curr; // add } to code buffer
					// switch to block mode
					mode = modes.BLK;
					
					codeNestLevel -= 1;
					if(codeNestLevel === 0){
						
						buffers.push( { type: modes.BLK, value: codeBuffer } );
						codeBuffer = '';
						markupBuffer = '';
						mode = modes.MKP;
					}
				}
				
				continue;
				
			} else {
				markupBuffer += curr;
				continue;
			}
		}
	
		if(mode === modes.BLK){
		
			if(TKS.AT.test(curr) === true){
				// current character is @
			
				if(TKS.AT.test(next) === true){
					// escaped @, continue, but ignore one @
					codeBuffer += curr;
					i += 1; // skip next @
				} else {
				
					buffers.push( { type: modes.BLK, value: codeBuffer } );
					codeBuffer = '';
					markupBuffer = '';
					mode = modes.MKP;
					continue;
				}
			
			} else if(TKS.LT.test(curr) === true){
				// current character is <
			
				if(TKS.TAGOC.test(next) === true){
					// we have a markup tag
					// switch to markup mode
				
					buffers.push( { type: modes.BLK, value: codeBuffer } );
					codeBuffer = '';
					markupBuffer = curr;
					mode = modes.MKP;
					continue;
				}
			
			} else if(TKS.BRACEEND.test(curr) === true) {
				codeBuffer += curr;
				codeNestLevel -= 1;
				if(codeNestLevel === 0){
					
					buffers.push( { type: modes.BLK, value: codeBuffer } );
					codeBuffer = '';
					markupBuffer = '';
					mode = modes.MKP;
					continue;
				}
				
			} 
			
			codeBuffer += curr;
			continue;		
		}
	
		if(mode === modes.EXP){
			// test for identifier
			identifier = str.substring(i);
			identifierMatch = identifier.match( TKS.IDENTIFIER );
		
			if(identifierMatch === null){
				
				if(TKS.AT.test(curr) === true){
					// must just be standalone @, switch to markup mode
					markupBuffer += curr;

					buffers.push( { type: modes.MPK, value: markupBuffer } );
					markupBuffer = ''; // blank out markup buffer;
					codeBuffer = ''; // blank out just in case
					mode = modes.MKP;
					continue;
				} else {
					// this is probably the end of the expression
					
					// end of expression, switch to markup mode
				
					buffers.push( { type: modes.EXP, value: codeBuffer } );
					codeBuffer = '';
					markupBuffer = curr;
					mode = modes.MKP;
					continue;
				}
				
			} else {
				// found a valid JS identifier
			
				codeBuffer += identifierMatch[0];
				j = i + identifierMatch[0].length;
				//j = i += identifierMatch[0].length; // set i and j to next char after identifier for next iteration
				next = str[j]; // set next to the actual next char after identifier
			
				if(TKS.PARENSTART.test(next) === true){
					// found (, consume until next matching
						
					i = j; // move i forward
					
					groupLevel = 1;
					while( groupLevel > 0 ){
						j += 1;
						curr = str[j];
						if(j < str.length - 1) next = str[j+1];
					
						if(TKS.PARENSTART.test(curr) === true) groupLevel += 1;
						if(TKS.PARENEND.test(curr) === true) groupLevel -= 1;
					
						if(j >= str.length) throw new Error('Syntax Error, unmatched PARENSTART');
					}
				
					// add ( something something (something something) ) to codeBuffer
					// TODO: may need to substring j+1
					codeBuffer += str.substring(i, j);
				
					i = j; // advance i to current char
					curr = str[i]; // curr will be equal to )
					if(i < str.length - 1) next = str[i+1];
				} else if(TKS.HARDPARENSTART.test(next) === true){
					// found [, consume until next matching
					
					i = j; // move i forward
					
					groupLevel = 1;
					while( groupLevel > 0 ){
						j += 1;
						curr = str[j];
						if(j < str.length - 1) next = str[j+1];
					
						if(TKS.HARDPARENSTART.test(curr) === true) groupLevel += 1;
						if(TKS.HARDPARENEND.test(curr) === true) groupLevel -= 1;
					
						if(j >= str.length) throw new Error('Syntax Error, unmatched HARDPARENSTART');
					}
				
					// add [ something something [something something] ] to codeBuffer
					// TODO: may need to substring j+1
					codeBuffer += str.substring(i, j+1);
				
					i = j; // advance i to current char
					curr = str[i]; // curr will be equal to ]
					if(i < str.length - 1) next = str[i+1];
				} else if(TKS.PERIOD.test(next) === true){
					// next char is a .
				
					if( i+2 < str.length && TKS.IDENTIFIER.test( str[i+2] ) ){
						// char after the . is a valid identifier
						// consume ., continue in EXP mode
						codeBuffer += next;
					} else {
						// do not consume . in code, but in markup
						// end EXP block, continue in markup mode 
					
						buffers.push( { type: modes.EXP, value: codeBuffer } );
						markupBuffer = next; // consume . in markup buffer
						codeBuffer = ''; // blank out 
						mode = modes.MKP;
						continue;
					}
				
				}
			}
		}
	}

	buffers.push( { type: modes.MKP, value: markupBuffer } );
	markupBuffer = ''; // blank out markup buffer;
	codeBuffer = ''; // blank out just in case
	mode = modes.MKP;
	return buffers;

}

function generateTemplate(buffers){
	var  i
		,current
		,generated = 'out = "";\n';
	
	for(i = 0; i < buffers.length; i++){
		current = buffers[i];
		
		if(current.type === modes.MKP){
			generated += 'out += \'' + current.value.replace(TKS.QUOTE, '\"').replace(TKS.LINEBREAK, '\\n') + '\';\n';
		}
		
		if(current.type === modes.BLK){
			// nuke new lines, otherwise causes parse error
			generated += current.value.replace(TKS.QUOTE, '\"').replace(TKS.LINEBREAK, '') + '\n';
		}
		
		if(current.type === modes.EXP){
			generated += 'out += (' + current.value.replace(TKS.QUOTE, '\"').replace(TKS.LINEBREAK, '\\n') + ');\n';
		}
	}
	
	return new Function("model", "with(model){" + generated + "}\nreturn out;");
}

root.razor = {
	 _parse: parse
	,tpl: generateTemplate
};

})(this);