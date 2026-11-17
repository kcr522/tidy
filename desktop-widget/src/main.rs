// Tidy 달력 위젯: Tidy 웹의 /widget 화면을 테두리 없는 투명한 창에 띄워 바탕화면 위젯처럼 쓴다.
// 투명도 · 데이터는 웹 화면이 맡고, 이 앱은 창만 만든다 (앱 크기 수 MB).
// 구글 로그인은 앱 안이 아니라 컴퓨터의 기본 브라우저에서 하고, 끝나면 tidy-widget:// 링크로 돌아온다.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::webview::NewWindowResponse;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_opener::OpenerExt;

const SITE: &str = "https://tidy-gules.vercel.app";

/// tidy-widget://login#<구글 ID 토큰> 을 받으면 위젯 화면에 넘겨 로그인시킨다
fn handle_links(app: &AppHandle, urls: Vec<tauri::Url>) {
  for url in urls {
    if url.scheme() != "tidy-widget" {
      continue;
    }
    let token = url.fragment().unwrap_or_default();
    if token.is_empty() || !token.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_')) {
      continue;
    }
    if let Some(w) = app.get_webview_window("main") {
      let _ = w.eval(format!("window.__tidyDeskLogin && window.__tidyDeskLogin('{token}')"));
      let _ = w.show();
      let _ = w.set_focus();
    }
  }
}

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
      }
    }))
    .plugin(tauri_plugin_deep_link::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_window_state::Builder::default().build())
    .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
    .setup(|app| {
      // 컴퓨터를 켤 때마다 위젯이 뜨게 (끄려면 시스템 설정의 로그인 항목에서)
      let autostart = app.autolaunch();
      if !autostart.is_enabled().unwrap_or(true) {
        let _ = autostart.enable();
      }

      #[cfg(any(windows, target_os = "linux"))]
      let _ = app.deep_link().register_all();
      let links = app.handle().clone();
      app.deep_link().on_open_url(move |event| handle_links(&links, event.urls()));

      let handle = app.handle().clone();
      WebviewWindowBuilder::new(app, "main", WebviewUrl::External(format!("{SITE}/widget?desk=1").parse().unwrap()))
        .title("Tidy 달력")
        .inner_size(420.0, 460.0)
        .min_inner_size(260.0, 240.0)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_bottom(true)
        // 새 창(로그인 등)은 앱 안에 열지 않고 컴퓨터의 기본 브라우저로 연다
        .on_new_window(move |url, _features| {
          if url.scheme() == "https" {
            let _ = handle.opener().open_url(url.as_str(), None::<&str>);
          }
          NewWindowResponse::Deny
        })
        .build()?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("Tidy 달력 위젯을 켜지 못했어요");
}
