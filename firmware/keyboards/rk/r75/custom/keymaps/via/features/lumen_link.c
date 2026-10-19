// RK Lumen app link. See lumen_link.h for the protocol.
#include "lumen_link.h"
#include "via.h"
#include "eeconfig.h"
#include "socd_cleaner.h"

extern socd_cleaner_t socd_v;
extern socd_cleaner_t socd_h;

#define LUMEN_MAGIC 0xA5
#define LUMEN_FW_VERSION 1

enum lumen_value_id {
    LV_INFO         = 0x01,  // get: [ver, capability bits]
    LV_SOCD_ON      = 0x02,  // get/set: 0/1
    LV_SOCD_MODE_V  = 0x03,  // get/set: socd_cleaner_resolution for W/S
    LV_SOCD_MODE_H  = 0x04,  // get/set: socd_cleaner_resolution for A/D
    LV_NKRO         = 0x05,  // get/set: 0/1
    LV_GUI_LOCK     = 0x06,  // get/set: 0/1 (disables the Windows key)
    LV_LAYER        = 0x07,  // get: [highest active layer, layer_state low byte]
    LV_SOCD_KEYS_V  = 0x08,  // get/set: [key0, key1] basic keycodes
    LV_SOCD_KEYS_H  = 0x09,  // get/set: [key0, key1] basic keycodes
};

enum lumen_caps {
    LC_SOCD     = 1 << 0,
    LC_NKRO     = 1 << 1,
    LC_GUI_LOCK = 1 << 2,
    LC_LAYER    = 1 << 3,
    LC_SOCD_KEYS = 1 << 4,
};

typedef struct __attribute__((packed)) {
    uint8_t magic;
    uint8_t enabled;
    uint8_t mode_v;
    uint8_t mode_h;
    uint8_t keys_v[2];
    uint8_t keys_h[2];
} lumen_cfg_t;

static void clear_socd_state(void) {
    socd_v.ignored[0] = socd_v.ignored[1] = false;
    socd_h.ignored[0] = socd_h.ignored[1] = false;
}

static bool valid_mode(uint8_t m) {
    return m < SOCD_CLEANER_NUM_RESOLUTIONS;
}

static bool valid_key(uint8_t k) {
    return k >= KC_A && k <= KC_RGUI;  // basic keys and modifiers only
}

void lumen_link_load(void) {
    lumen_cfg_t cfg;
    via_read_custom_config(&cfg, 0, sizeof(cfg));
    if (cfg.magic != LUMEN_MAGIC) return;  // nothing saved yet: keep defaults (SOCD off)
    socd_cleaner_enabled = cfg.enabled ? true : false;
    if (valid_mode(cfg.mode_v)) socd_v.resolution = cfg.mode_v;
    if (valid_mode(cfg.mode_h)) socd_h.resolution = cfg.mode_h;
    if (valid_key(cfg.keys_v[0]) && valid_key(cfg.keys_v[1]) && cfg.keys_v[0] != cfg.keys_v[1]) {
        socd_v.keys[0] = cfg.keys_v[0];
        socd_v.keys[1] = cfg.keys_v[1];
    }
    if (valid_key(cfg.keys_h[0]) && valid_key(cfg.keys_h[1]) && cfg.keys_h[0] != cfg.keys_h[1]) {
        socd_h.keys[0] = cfg.keys_h[0];
        socd_h.keys[1] = cfg.keys_h[1];
    }
}

static void lumen_get(uint8_t *command_id, uint8_t *v) {
    switch (v[0]) {
        case LV_INFO:
            v[1] = LUMEN_FW_VERSION;
            v[2] = LC_SOCD | LC_NKRO | LC_GUI_LOCK | LC_LAYER | LC_SOCD_KEYS;
            break;
        case LV_SOCD_ON:     v[1] = socd_cleaner_enabled ? 1 : 0; break;
        case LV_SOCD_MODE_V: v[1] = socd_v.resolution; break;
        case LV_SOCD_MODE_H: v[1] = socd_h.resolution; break;
        case LV_NKRO:        v[1] = keymap_config.nkro ? 1 : 0; break;
        case LV_GUI_LOCK:    v[1] = keymap_config.no_gui ? 1 : 0; break;
        case LV_LAYER:
            v[1] = get_highest_layer(layer_state | default_layer_state);
            v[2] = (uint8_t)(layer_state & 0xFF);
            break;
        case LV_SOCD_KEYS_V: v[1] = socd_v.keys[0]; v[2] = socd_v.keys[1]; break;
        case LV_SOCD_KEYS_H: v[1] = socd_h.keys[0]; v[2] = socd_h.keys[1]; break;
        default: *command_id = id_unhandled; break;
    }
}

static void lumen_set(uint8_t *command_id, uint8_t *v) {
    switch (v[0]) {
        case LV_SOCD_ON:
            socd_cleaner_enabled = v[1] ? true : false;
            clear_socd_state();
            break;
        case LV_SOCD_MODE_V:
            if (valid_mode(v[1])) { socd_v.resolution = v[1]; clear_socd_state(); }
            break;
        case LV_SOCD_MODE_H:
            if (valid_mode(v[1])) { socd_h.resolution = v[1]; clear_socd_state(); }
            break;
        case LV_NKRO:
            clear_keyboard();  // avoid stuck keys when the report format changes
            keymap_config.nkro = v[1] ? true : false;
            break;
        case LV_GUI_LOCK:
            keymap_config.no_gui = v[1] ? true : false;
            break;
        case LV_SOCD_KEYS_V:
            if (valid_key(v[1]) && valid_key(v[2]) && v[1] != v[2]) { socd_v.keys[0] = v[1]; socd_v.keys[1] = v[2]; socd_v.held[0] = socd_v.held[1] = false; clear_socd_state(); }
            break;
        case LV_SOCD_KEYS_H:
            if (valid_key(v[1]) && valid_key(v[2]) && v[1] != v[2]) { socd_h.keys[0] = v[1]; socd_h.keys[1] = v[2]; socd_h.held[0] = socd_h.held[1] = false; clear_socd_state(); }
            break;
        default: *command_id = id_unhandled; break;
    }
}

static void lumen_save(void) {
    lumen_cfg_t cfg = {
        .magic = LUMEN_MAGIC,
        .enabled = socd_cleaner_enabled ? 1 : 0,
        .mode_v = socd_v.resolution,
        .mode_h = socd_h.resolution,
        .keys_v = {socd_v.keys[0], socd_v.keys[1]},
        .keys_h = {socd_h.keys[0], socd_h.keys[1]},
    };
    via_update_custom_config(&cfg, 0, sizeof(cfg));
    eeconfig_update_keymap(&keymap_config);  // NKRO and GUI lock live here
}

// Channel 0 is ours; the core handles the RGB channels (1-5) before this is called.
void via_custom_value_command_kb(uint8_t *data, uint8_t length) {
    uint8_t *command_id = &data[0];
    if (data[1] != id_custom_channel) {
        *command_id = id_unhandled;
        return;
    }
    switch (*command_id) {
        case id_custom_get_value:  lumen_get(command_id, &data[2]); break;
        case id_custom_set_value:  lumen_set(command_id, &data[2]); break;
        case id_custom_save:       lumen_save(); break;
        default: *command_id = id_unhandled; break;
    }
}
