"""Code-defined switch hardening rule catalog.

Each rule maps to PCI DSS v4.0.1 requirements and ISO 27001:2022 Annex A
controls, and carries a per-platform regex check plus remediation command
template. Pure module — no device I/O — so it stays trivially unit-testable.
"""

import re
from dataclasses import dataclass, field

# Platform keys used throughout this module and by callers.
PLATFORM_ALIASES = {
    "ios": "ios",
    "nxos": "nxos",
    "nxos_ssh": "nxos",
    "junos": "junos",
}


def normalize_platform(platform: str | None) -> str | None:
    if not platform:
        return None
    return PLATFORM_ALIASES.get(platform)


@dataclass(frozen=True)
class PlatformCheck:
    match: str
    expect: bool = True
    remediation: str = ""


@dataclass(frozen=True)
class ComplianceRule:
    id: str
    title: str
    description: str
    severity: str  # high | medium | low
    pci_dss: tuple[str, ...]
    iso27001: tuple[str, ...]
    platforms: dict[str, PlatformCheck]
    variables: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class RuleResult:
    rule_id: str
    status: str  # pass | fail | skipped | not_applicable | error
    evidence: str = ""
    remediation_commands: str = ""


RULES: list[ComplianceRule] = [
    ComplianceRule(
        id="NTP-01",
        title="NTP server configured",
        description="Device synchronizes its clock with an approved NTP server.",
        severity="high",
        pci_dss=("10.6.1", "10.6.2", "10.6.3"),
        iso27001=("A.8.17",),
        variables=("ntp_server",),
        platforms={
            "ios": PlatformCheck(
                match=r"^ntp server {ntp_server}\b",
                remediation="ntp server {ntp_server}",
            ),
            "nxos": PlatformCheck(
                match=r"^ntp server {ntp_server}\b",
                remediation="ntp server {ntp_server}",
            ),
            "junos": PlatformCheck(
                match=r"^set system ntp server {ntp_server}\b",
                remediation="set system ntp server {ntp_server}",
            ),
        },
    ),
    ComplianceRule(
        id="LOG-01",
        title="Remote syslog server configured",
        description="Logs are forwarded to a central syslog server.",
        severity="high",
        pci_dss=("10.2.1", "10.3.3"),
        iso27001=("A.8.15",),
        variables=("syslog_server",),
        platforms={
            "ios": PlatformCheck(
                match=r"^logging (host )?{syslog_server}\b",
                remediation="logging host {syslog_server}",
            ),
            "nxos": PlatformCheck(
                match=r"^logging server {syslog_server}\b",
                remediation="logging server {syslog_server}",
            ),
            "junos": PlatformCheck(
                match=r"^set system syslog host {syslog_server}\b",
                remediation="set system syslog host {syslog_server}",
            ),
        },
    ),
    ComplianceRule(
        id="LOG-02",
        title="Log timestamps enabled",
        description="Log entries include timestamps for forensic correlation.",
        severity="medium",
        pci_dss=("10.2.2",),
        iso27001=("A.8.15",),
        platforms={
            "ios": PlatformCheck(
                match=r"^service timestamps log datetime",
                remediation="service timestamps log datetime msec localtime show-timezone",
            ),
        },
    ),
    ComplianceRule(
        id="DNS-01",
        title="Approved DNS server configured",
        description="Device resolves names using an approved DNS server.",
        severity="low",
        pci_dss=("2.2.1",),
        iso27001=("A.8.9",),
        variables=("dns_server",),
        platforms={
            "ios": PlatformCheck(
                match=r"^ip name-server.*\b{dns_server}\b",
                remediation="ip name-server {dns_server}",
            ),
            "nxos": PlatformCheck(
                match=r"^ip name-server.*\b{dns_server}\b",
                remediation="ip name-server {dns_server}",
            ),
            "junos": PlatformCheck(
                match=r"^set system name-server {dns_server}\b",
                remediation="set system name-server {dns_server}",
            ),
        },
    ),
    ComplianceRule(
        id="SSH-01",
        title="SSH protocol v2 only",
        description="Only the SSHv2 protocol is permitted for management access.",
        severity="high",
        pci_dss=("2.2.7",),
        iso27001=("A.8.20", "A.8.21"),
        platforms={
            "ios": PlatformCheck(
                match=r"^ip ssh version 2",
                remediation="ip ssh version 2",
            ),
            "junos": PlatformCheck(
                match=r"^set system services ssh protocol-version v2",
                remediation="set system services ssh protocol-version v2",
            ),
        },
    ),
    ComplianceRule(
        id="VTY-01",
        title="Telnet disabled",
        description="Telnet management access is disabled in favor of SSH.",
        severity="high",
        pci_dss=("2.2.5", "2.2.7"),
        iso27001=("A.8.20",),
        platforms={
            "ios": PlatformCheck(
                match=r"^\s*transport input (all|telnet)\b",
                expect=False,
                remediation="line vty 0 15\n transport input ssh",
            ),
            "nxos": PlatformCheck(
                match=r"^feature telnet\b",
                expect=False,
                remediation="no feature telnet",
            ),
            "junos": PlatformCheck(
                match=r"^set system services telnet\b",
                expect=False,
                remediation="delete system services telnet",
            ),
        },
    ),
    ComplianceRule(
        id="HTTP-01",
        title="HTTP management server disabled",
        description="The unencrypted HTTP management server is disabled.",
        severity="high",
        pci_dss=("2.2.5",),
        iso27001=("A.8.9",),
        platforms={
            "ios": PlatformCheck(
                match=r"^ip http server\b",
                expect=False,
                remediation="no ip http server\nno ip http secure-server",
            ),
            "nxos": PlatformCheck(
                match=r"^feature nxapi\b",
                expect=False,
                remediation="no feature nxapi",
            ),
            "junos": PlatformCheck(
                match=r"^set system services web-management http\b",
                expect=False,
                remediation="delete system services web-management http",
            ),
        },
    ),
    ComplianceRule(
        id="PWD-01",
        title="Password encryption at rest",
        description="Locally stored passwords are encrypted (type 7/secret).",
        severity="medium",
        pci_dss=("8.3.2",),
        iso27001=("A.5.17",),
        platforms={
            "ios": PlatformCheck(
                match=r"^service password-encryption",
                remediation="service password-encryption",
            ),
        },
    ),
    ComplianceRule(
        id="PWD-02",
        title="Password minimum length enforced",
        description="Local passwords must meet a minimum length policy.",
        severity="high",
        pci_dss=("8.3.6",),
        iso27001=("A.5.17",),
        variables=("password_min_length",),
        platforms={
            "ios": PlatformCheck(
                match=r"^security passwords min-length {password_min_length}\b",
                remediation="security passwords min-length {password_min_length}",
            ),
            "junos": PlatformCheck(
                match=r"^set system login password minimum-length {password_min_length}\b",
                remediation="set system login password minimum-length {password_min_length}",
            ),
        },
    ),
    ComplianceRule(
        id="PWD-03",
        title="Password strength checking enabled",
        description="Device-enforced password complexity checking is enabled.",
        severity="medium",
        pci_dss=("8.3.6",),
        iso27001=("A.5.17",),
        platforms={
            "nxos": PlatformCheck(
                match=r"^no password strength-check\b",
                expect=False,
                remediation="password strength-check",
            ),
        },
    ),
    ComplianceRule(
        id="TIMEOUT-01",
        title="Idle session timeout configured",
        description="Management sessions are disconnected after a bounded idle period.",
        severity="medium",
        pci_dss=("8.2.8",),
        iso27001=("A.8.5",),
        variables=("exec_timeout_minutes",),
        platforms={
            "ios": PlatformCheck(
                match=r"^\s*exec-timeout {exec_timeout_minutes} 0\b",
                remediation=(
                    "line vty 0 15\n"
                    " exec-timeout {exec_timeout_minutes} 0\n"
                    "line con 0\n"
                    " exec-timeout {exec_timeout_minutes} 0"
                ),
            ),
            "nxos": PlatformCheck(
                match=r"^\s*exec-timeout {exec_timeout_minutes}\b",
                remediation="line vty\n exec-timeout {exec_timeout_minutes}",
            ),
            "junos": PlatformCheck(
                match=r"^set system login class \S+ idle-timeout {exec_timeout_minutes}\b",
                remediation=(
                    "set system login class netconsole-hardened "
                    "idle-timeout {exec_timeout_minutes}"
                ),
            ),
        },
    ),
    ComplianceRule(
        id="LOGIN-01",
        title="Login brute-force lockout configured",
        description="Repeated failed logins trigger a temporary lockout.",
        severity="high",
        pci_dss=("8.3.4",),
        iso27001=("A.5.17", "A.8.5"),
        platforms={
            "ios": PlatformCheck(
                match=r"^login block-for\b",
                remediation="login block-for 120 attempts 5 within 60",
            ),
            "nxos": PlatformCheck(
                match=r"^login block-for\b",
                remediation="login block-for 120 attempts 5 within 60",
            ),
            "junos": PlatformCheck(
                match=r"^set system login retry-options\b",
                remediation=(
                    "set system login retry-options tries-before-disconnect 3\n"
                    "set system login retry-options lockout-period 15"
                ),
            ),
        },
    ),
    ComplianceRule(
        id="BANNER-01",
        title="Login warning banner configured",
        description="A legal warning banner is displayed before authentication.",
        severity="low",
        pci_dss=("2.2.1",),
        iso27001=("A.8.5",),
        platforms={
            "ios": PlatformCheck(
                match=r"^banner (motd|login)\b",
                remediation="banner login ^C Unauthorized access is prohibited. ^C",
            ),
            "nxos": PlatformCheck(
                match=r"^banner motd\b",
                remediation="banner motd ^C Unauthorized access is prohibited. ^C",
            ),
            "junos": PlatformCheck(
                match=r"^set system login message\b",
                remediation='set system login message "Unauthorized access is prohibited."',
            ),
        },
    ),
    ComplianceRule(
        id="AAA-01",
        title="Centralized AAA authentication enabled",
        description="Management authentication is delegated to a centralized AAA service.",
        severity="high",
        pci_dss=("7.2.1", "8.2.1"),
        iso27001=("A.5.16", "A.8.2"),
        platforms={
            "ios": PlatformCheck(
                match=r"^aaa new-model",
                remediation="aaa new-model",
            ),
            "nxos": PlatformCheck(
                match=r"^aaa authentication login default group\b",
                remediation="aaa authentication login default group radius",
            ),
            "junos": PlatformCheck(
                match=r"^set system authentication-order\b",
                remediation="set system authentication-order [radius password]",
            ),
        },
    ),
    ComplianceRule(
        id="SNMP-01",
        title="No default SNMP communities",
        description="Default public/private SNMP community strings are removed.",
        severity="high",
        pci_dss=("2.2.2",),
        iso27001=("A.8.9",),
        platforms={
            "ios": PlatformCheck(
                match=r"^snmp-server community (public|private)\b",
                expect=False,
                remediation="no snmp-server community public\nno snmp-server community private",
            ),
            "nxos": PlatformCheck(
                match=r"^snmp-server community (public|private)\b",
                expect=False,
                remediation="no snmp-server community public\nno snmp-server community private",
            ),
            "junos": PlatformCheck(
                match=r"^set snmp community (public|private)\b",
                expect=False,
                remediation="delete snmp community public\ndelete snmp community private",
            ),
        },
    ),
    ComplianceRule(
        id="SNMP-02",
        title="No SNMP v1/v2c read-write communities",
        description="No SNMP community string grants read-write access.",
        severity="high",
        pci_dss=("2.2.5",),
        iso27001=("A.8.9",),
        platforms={
            "ios": PlatformCheck(
                match=r"^snmp-server community \S+ [Rr][Ww]\b",
                expect=False,
                remediation="! review and remove manually: no snmp-server community <name> RW",
            ),
            "nxos": PlatformCheck(
                match=r"^snmp-server community \S+ [Rr][Ww]\b",
                expect=False,
                remediation="! review and remove manually: no snmp-server community <name> RW",
            ),
            "junos": PlatformCheck(
                match=r"^set snmp community \S+ authorization read-write\b",
                expect=False,
                remediation=(
                    "! review and remove manually: delete snmp community "
                    "<name> authorization read-write"
                ),
            ),
        },
    ),
]

_RULES_BY_ID = {rule.id: rule for rule in RULES}


def get_rule(rule_id: str) -> ComplianceRule | None:
    return _RULES_BY_ID.get(rule_id)


def evaluate_rules(
    config_text: str, platform: str | None, variables: dict[str, str | int | None]
) -> list[RuleResult]:
    """Evaluate the full rule catalog against a device config's text.

    `variables` is the switch's effective compliance profile (e.g.
    {"ntp_server": "10.0.0.1", "password_min_length": 12, ...}). A rule whose
    required variable(s) are missing/empty is reported as "skipped".
    """
    plat = normalize_platform(platform)
    lines = config_text.splitlines()
    results: list[RuleResult] = []

    for rule in RULES:
        check = rule.platforms.get(plat) if plat else None
        if check is None:
            results.append(RuleResult(rule.id, "not_applicable"))
            continue

        missing = [v for v in rule.variables if not variables.get(v)]
        if missing:
            results.append(
                RuleResult(
                    rule.id,
                    "skipped",
                    evidence=f"Missing profile variable(s): {', '.join(missing)}",
                )
            )
            continue

        match_fmt = {v: re.escape(str(variables[v])) for v in rule.variables}
        try:
            pattern = re.compile(check.match.format(**match_fmt))
        except re.error as exc:
            results.append(RuleResult(rule.id, "error", evidence=str(exc)))
            continue

        matched_line = ""
        for line in lines:
            if pattern.search(line):
                matched_line = line.strip()
                break

        found = bool(matched_line)
        passed = found if check.expect else not found
        if passed:
            evidence = matched_line if check.expect else ""
            results.append(RuleResult(rule.id, "pass", evidence=evidence))
            continue

        remediation = ""
        if check.remediation:
            remediation_fmt = {v: str(variables[v]) for v in rule.variables}
            remediation = check.remediation.format(**remediation_fmt)
        evidence = matched_line if not check.expect else ""
        results.append(
            RuleResult(rule.id, "fail", evidence=evidence, remediation_commands=remediation)
        )

    return results
