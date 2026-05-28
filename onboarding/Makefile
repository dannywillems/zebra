.PHONY: help
help: ## Ask for help!
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; \
		{printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

.PHONY: install
install: ## Install Node dependencies
	npm install

.PHONY: dev
dev: ## Run the Docusaurus dev server on http://localhost:3000
	npx docusaurus start --port 3000

.PHONY: build
build: ## Build the static site under build/
	npx docusaurus build

.PHONY: preview
preview: ## Serve the built site for local inspection
	npx docusaurus serve --port 3000

.PHONY: check-format
check-format: ## Check formatting of docs/ and src/
	npx prettier --check "docs/**/*.md" "src/**/*" "*.ts" "*.json"

.PHONY: format
format: ## Auto-format docs/ and src/
	npx prettier --write "docs/**/*.md" "src/**/*" "*.ts" "*.json"

.PHONY: audit
audit: ## Audit the dependency tree for known CVEs
	npm audit

.PHONY: clean
clean: ## Clear the Docusaurus cache and build output
	npx docusaurus clear
	rm -rf build node_modules

.PHONY: typecheck
typecheck: ## Type-check the TypeScript config
	npx tsc --noEmit
