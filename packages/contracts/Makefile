NETWORK=rinkeby

build:
	npx truffle build

deploy-rdai: build
	npx truffle exec --network $(NETWORK) scripts/deploy-rdai.js

.PHONY: build deploy-rdai
