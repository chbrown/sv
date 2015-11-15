BIN := node_modules/.bin
TYPESCRIPT := common.ts index.ts parser.ts stringifier.ts
JAVASCRIPT := $(TYPESCRIPT:%.ts=%.js)

all: $(JAVASCRIPT)

$(BIN)/mocha $(BIN)/tsc:
	npm install

compile:
	$(BIN)/tsc -d

%.js: %.ts $(BIN)/tsc
	$(BIN)/tsc

test: $(JAVASCRIPT) $(BIN)/mocha
	$(BIN)/mocha --compilers js:babel-core/register tests/
