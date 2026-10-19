// RK Lumen app link: custom VIA channel 0 for SOCD / NKRO / GUI lock / layer readout.
// Protocol (VIA custom value commands, channel id 0):
//   get : [0x08, 0x00, value_id, ...]  -> reply fills data[3...]
//   set : [0x07, 0x00, value_id, ...]
//   save: [0x09, 0x00]                 -> persists SOCD settings (and NKRO / GUI lock) to EEPROM
#pragma once

#include "quantum.h"

void lumen_link_load(void);
