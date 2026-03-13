.PHONY: clean build

CLI = node ./src/index.js

build: parse-reports consolidate

parse-reports:
	$(CLI) parse-reports -i reports/downloaded -o reports/parsed
	$(CLI) parse-financial-reports -i reports/downloaded/financial-reports -o reports/parsed/financial-reports

consolidate:
	$(CLI) consolidate-reports -i reports/parsed -o reports
	$(CLI) consolidate-financials -i reports/downloaded/financial-data -o reports/financials.json
	$(CLI) consolidate-current-year-financials -b reports/downloaded/financial-reports/2026-proposed-budget.json -a reports/parsed/financial-reports -o reports/current-year-financials.json
