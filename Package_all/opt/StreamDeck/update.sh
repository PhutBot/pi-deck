#!/bin/bash -v

if [ ! -d "/home/pi/PiDeck" ]; then
    pushd /home/pi
    git clone git@github.com:PhutBotDepot/pi-deck.git
    popd
fi

pushd /home/pi/PiDeck
    git pull

    VERSION=0.2
    TOKEN=$1

    ./build.sh $VERSION $TOKEN
    rm -r PiDeck_${VERSION}_all
    su pi -c "sudo dpkg -i PiDeck_${VERSION}_all.deb"
popd
