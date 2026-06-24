use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::config;
use crate::error::AppResult;
use crate::model::ServiceConfig;

const BEGIN_MARKER: &str = "# BEGIN TUNNELDESK";
const END_MARKER: &str = "# END TUNNELDESK";

pub fn hosts_path() -> PathBuf {
    if cfg!(target_os = "windows") {
        PathBuf::from(r"C:\Windows\System32\drivers\etc\hosts")
    } else {
        PathBuf::from("/etc/hosts")
    }
}

pub fn can_write_hosts() -> bool {
    fs::OpenOptions::new()
        .append(true)
        .open(hosts_path())
        .is_ok()
}

pub fn block_present() -> bool {
    fs::read_to_string(hosts_path())
        .map(|content| content.contains(BEGIN_MARKER) && content.contains(END_MARKER))
        .unwrap_or(false)
}

pub fn write_services_block(services: &[ServiceConfig]) -> AppResult<()> {
    backup_hosts()?;
    let content = fs::read_to_string(hosts_path()).unwrap_or_default();
    let block = render_block(services);
    let next = replace_block(&content, Some(&block));
    fs::write(hosts_path(), next)?;
    flush_dns();
    Ok(())
}

pub fn remove_block() -> AppResult<()> {
    backup_hosts()?;
    let content = fs::read_to_string(hosts_path()).unwrap_or_default();
    let next = replace_block(&content, None);
    fs::write(hosts_path(), next)?;
    flush_dns();
    Ok(())
}

fn backup_hosts() -> AppResult<()> {
    let content = fs::read_to_string(hosts_path()).unwrap_or_default();
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default();
    let backup_path = config::backups_dir()?.join(format!("hosts.{ts}.bak"));
    let mut file = fs::File::create(backup_path)?;
    file.write_all(content.as_bytes())?;
    Ok(())
}

fn flush_dns() {
    #[cfg(target_os = "windows")]
    let _ = Command::new("ipconfig").arg("/flushdns").output();
    #[cfg(target_os = "linux")]
    let _ = Command::new("resolvectl").arg("flush-caches").output();
}

pub fn render_block(services: &[ServiceConfig]) -> String {
    let mut lines = Vec::new();
    lines.push(String::from(BEGIN_MARKER));
    for service in services.iter().filter(|service| service.enabled) {
        lines.push(format!("{} {}", service.local_ip, service.domain));
    }
    lines.push(String::from(END_MARKER));
    lines.join("\n")
}

pub fn replace_block(content: &str, block: Option<&str>) -> String {
    let mut lines = content.lines().collect::<Vec<_>>();
    let begin = lines.iter().position(|line| line.trim() == BEGIN_MARKER);
    let end = lines.iter().position(|line| line.trim() == END_MARKER);

    if let (Some(begin), Some(end)) = (begin, end) {
        if begin <= end {
            lines.drain(begin..=end);
        }
    }

    let mut next = lines.join("\n").trim_end().to_string();
    if let Some(block) = block {
        if !next.is_empty() {
            next.push_str("\n\n");
        }
        next.push_str(block);
    }
    next.push('\n');
    next
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replace_block_is_idempotent() {
        let first = replace_block(
            "a\n",
            Some("# BEGIN TUNNELDESK\n127.0.0.1 a\n# END TUNNELDESK"),
        );
        let second = replace_block(
            &first,
            Some("# BEGIN TUNNELDESK\n127.0.0.1 a\n# END TUNNELDESK"),
        );
        assert_eq!(first, second);
    }

    #[test]
    fn remove_block_keeps_other_lines() {
        let content = "before\n# BEGIN TUNNELDESK\n127.0.0.1 a\n# END TUNNELDESK\nafter\n";
        let next = replace_block(content, None);
        assert!(next.contains("before"));
        assert!(next.contains("after"));
        assert!(!next.contains("127.0.0.1 a"));
    }
}
