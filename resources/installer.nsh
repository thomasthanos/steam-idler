; installer.nsh — custom install directory
; Sets install path to %APPDATA%\ThomasThanos\Souvlatzidiko-Unlocker

!macro preInit
  StrCpy $INSTDIR "$APPDATA\ThomasThanos\Souvlatzidiko-Unlocker"
!macroend
