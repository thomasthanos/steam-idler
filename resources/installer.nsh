!include "StrFunc.nsh"
${StrStr}

; ============================================================================
; NSIS OPTIMIZATIONS
; ============================================================================
SetCompressor /SOLID lzma
SetCompressorDictSize 32
SetDatablockOptimize on
AutoCloseWindow true

; ============================================================================
; customInit - Runs BEFORE installation
; ============================================================================
!macro customInit
  StrCpy $INSTDIR "$LOCALAPPDATA\ThomasThanos\Souvlatzidiko-Unlocker"

  ; Kill running process if any
  nsExec::ExecToStack 'wmic process where "name='\''Souvlatzidiko-Unlocker.exe'\''" get ProcessId /FORMAT:LIST'
  Pop $0
  Pop $1

  ${If} $0 == 0
    ${StrStr} $2 $1 "ProcessId="
    ${If} $2 != ""
      StrCpy $0 0
      wait_for_exit:
        FindWindow $3 "" "Souvlatzidiko-Unlocker"
        ${If} $3 == 0
          Goto process_exited
        ${EndIf}
        IntOp $0 $0 + 1
        IntCmp $0 5 process_exited
        Sleep 250
        Goto wait_for_exit
    ${EndIf}
  ${EndIf}

  process_exited:

  ; Remove old installation registry keys (check both HKLM and HKCU for upgrades)
  ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"
  ${If} $R0 == ""
    ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"
  ${EndIf}
  StrCmp $R0 "" done_uninstall

  ; Strip quotes
  StrCpy $R1 $R0 1
  StrCmp $R1 '"' 0 run_uninstall
    StrCpy $R0 $R0 "" 1
    StrCpy $R0 $R0 -1
  run_uninstall:
  ${If} ${FileExists} "$R0"
    ExecWait '"$R0" /S _?=$INSTDIR'
  ${EndIf}

  done_uninstall:
!macroend

; ============================================================================
; customInstall - Runs AFTER files are installed
; ============================================================================
!macro customInstall
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "DisplayName" "Souvlatzidiko-Unlocker ${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "Publisher" "ThomasThanos"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "DisplayIcon" "$INSTDIR\Souvlatzidiko-Unlocker.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "EstimatedSize" 0x0000C800

  ; AppUserModelID — must match app.setAppUserModelId() in main process
  WriteRegStr HKCU "Software\Classes\AppUserModelId\com.ThomasThanos.SouvlatzidikoUnlocker" "DisplayName" "Souvlatzidiko-Unlocker"
  WriteRegStr HKCU "Software\Classes\AppUserModelId\com.ThomasThanos.SouvlatzidikoUnlocker" "IconUri" "$INSTDIR\resources\all_steam_x256.ico"
!macroend

; ============================================================================
; customUnInstall - Runs during uninstallation
; ============================================================================
!macro customUnInstall
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}"
  DeleteRegKey HKCU "Software\Classes\AppUserModelId\com.ThomasThanos.SouvlatzidikoUnlocker"

  ${ifNot} ${isUpdated}
    ${If} ${FileExists} "$LOCALAPPDATA\ThomasThanos\Souvlatzidiko-Unlocker\*.*"
      RMDir /r "$LOCALAPPDATA\ThomasThanos\Souvlatzidiko-Unlocker"
    ${EndIf}
    ; Clean up parent folder if empty
    ${If} ${FileExists} "$LOCALAPPDATA\ThomasThanos"
      RMDir "$LOCALAPPDATA\ThomasThanos"
    ${EndIf}
  ${endIf}
!macroend
