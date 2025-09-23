# usage: sh parseABCDir.sh <dir>
# For every .abc file in <dir>, run `yarn ts ./tests/parseABC.ts <file>`

for f in $1/*.abc; do
	echo "Processing $f file..."
	yarn ts ./tests/parseABC.ts "$f"
	if [ $? -ne 0 ]; then
		echo "Error processing $f. Exiting."
		break
	fi
done
