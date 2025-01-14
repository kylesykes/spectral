#!/bin/sh

install () {

set -eu

UNAME=$(uname)
if [ "$UNAME" != "Linux" ] && [ "$UNAME" != "Darwin" ] ; then
  echo "Sorry, OS/Architecture not supported: ${UNAME}/${ARCH}. Download binary from https://github.com/stoplightio/spectral/releases"
  exit 1
fi

if [ "$UNAME" = "Darwin" ] ; then
  PLATFORM="macos"
elif [ "$UNAME" = "Linux" ] ; then
  PLATFORM="linux"
fi

URL="https://github.com/stoplightio/spectral/releases/latest/download/spectral-$PLATFORM"
SRC=$(pwd)/spectral-$PLATFORM
DEST=/usr/local/bin/spectral

STATUS=$(curl -sL -w %{http_code} -o $SRC $URL)
if [ $STATUS -ge 200 ] & [ $STATUS -le 308 ]; then
  mv $SRC $DEST
  chmod +x $DEST
  echo "Spectral installation was successful"
else
  rm $SRC
  echo "Error requesting. Download binary from ${URL}"
  exit 1
fi
}

install
