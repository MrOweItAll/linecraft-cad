; Original per-user native-drawing association for the pinned NSIS installer.
; A different application chosen by the user keeps its extension default.
!define LINECRAFT_DRAWING_PROGID "LinecraftCAD.Drawing"

!macro customInstall
  ; Read the merged default so a machine registration is preserved as well.
  ReadRegStr $R0 HKCR ".linecraft" ""
  ${If} $R0 == ""
  ${OrIf} $R0 == "${LINECRAFT_DRAWING_PROGID}"
    WriteRegStr HKCU "Software\Classes\.linecraft" "" "${LINECRAFT_DRAWING_PROGID}"
  ${EndIf}
  WriteRegNone HKCU "Software\Classes\.linecraft\OpenWithProgids" "${LINECRAFT_DRAWING_PROGID}"
  WriteRegStr HKCU "Software\Classes\${LINECRAFT_DRAWING_PROGID}" "" "Linecraft native drawing"
  WriteRegStr HKCU "Software\Classes\${LINECRAFT_DRAWING_PROGID}\DefaultIcon" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}",0'
  WriteRegStr HKCU "Software\Classes\${LINECRAFT_DRAWING_PROGID}\shell" "" "open"
  WriteRegStr HKCU "Software\Classes\${LINECRAFT_DRAWING_PROGID}\shell\open" "" "Open with Linecraft CAD"
  WriteRegStr HKCU "Software\Classes\${LINECRAFT_DRAWING_PROGID}\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro customUnInstall
  ; A different installation or another application's association is not ours.
  ReadRegStr $R0 HKCU "Software\Classes\${LINECRAFT_DRAWING_PROGID}\shell\open\command" ""
  ${If} $R0 == '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
    ReadRegStr $R1 HKCU "Software\Classes\.linecraft" ""
    ${If} $R1 == "${LINECRAFT_DRAWING_PROGID}"
      DeleteRegValue HKCU "Software\Classes\.linecraft" ""
    ${EndIf}
    DeleteRegValue HKCU "Software\Classes\.linecraft\OpenWithProgids" "${LINECRAFT_DRAWING_PROGID}"
    DeleteRegKey /ifempty HKCU "Software\Classes\.linecraft\OpenWithProgids"
    DeleteRegKey /ifempty HKCU "Software\Classes\.linecraft"
    DeleteRegKey HKCU "Software\Classes\${LINECRAFT_DRAWING_PROGID}"
    System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  ${EndIf}
!macroend
