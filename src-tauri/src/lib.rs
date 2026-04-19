pub mod commands;
pub mod lcu;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                lcu::watcher::start_watcher(handle).await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_lcu_status,
            commands::get_current_rune_pages,
            commands::save_champion_runes,
            commands::get_champion_runes,
            commands::get_all_champion_runes,
            commands::delete_champion_runes,
            commands::apply_runes_manually,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}