cp -r -p ./Package_all ./PiDeck_$1_all
cp ./*.py PiDeck_$1_all/opt/PiDeck

sed -i 's/$VERSION/'"$1"'/g' PiDeck_$1_all/DEBIAN/control

export SLOBS_TOKEN=$2
envsubst < Package_all/lib/systemd/system/pi-deck.service > PiDeck_$1_all/lib/systemd/system/pi-deck.service

dpkg --build PiDeck_$1_all
