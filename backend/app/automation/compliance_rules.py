"""Code-defined device hardening rule catalog.

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
    "eos": "eos",
}

# Profile variables that accept a comma-separated list of values. A rule using
# one of these passes only when every listed value is present in the config,
# and remediates only the values that are missing. Int-valued profile fields
# are deliberately absent so they can never be split.
MULTI_VALUE_VARIABLES = frozenset({"ntp_server", "syslog_server", "dns_server"})


def normalize_platform(platform: str | None) -> str | None:
    if not platform:
        return None
    return PLATFORM_ALIASES.get(platform)


def split_values(value: str | int | None) -> list[str]:
    """Split a profile value into its comma-separated parts.

    Deduplicates while preserving first-seen order — callers hash the rendered
    command list, so the order must be stable.
    """
    if value is None:
        return []
    values: list[str] = []
    for part in str(value).split(","):
        part = part.strip()
        if part and part not in values:
            values.append(part)
    return values


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
            "eos": PlatformCheck(
                match=r"^ntp server {ntp_server}\b",
                remediation="ntp server {ntp_server}",
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
            "eos": PlatformCheck(
                match=r"^logging host {syslog_server}\b",
                remediation="logging host {syslog_server}",
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
            "eos": PlatformCheck(
                match=r"^ip name-server.*\b{dns_server}\b",
                remediation="ip name-server {dns_server}",
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
            "eos": PlatformCheck(
                match=r"^\s*password minimum length {password_min_length}\b",
                remediation=(
                    "management security\n"
                    " password minimum length {password_min_length}"
                ),
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
            "eos": PlatformCheck(
                match=r"^\s*exec-timeout {exec_timeout_minutes} 0\b",
                remediation=(
                    "line vty 0 15\n"
                    " exec-timeout {exec_timeout_minutes} 0\n"
                    "line con 0\n"
                    " exec-timeout {exec_timeout_minutes} 0"
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
            "eos": PlatformCheck(
                match=r"^aaa authentication policy lockout\b",
                remediation="aaa authentication policy lockout failure 5 window 60 duration 120",
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
            "eos": PlatformCheck(
                match=r"^banner (motd|login)\b",
                remediation="banner login ^C Unauthorized access is prohibited. ^C",
            ),
        },
    ),
    ComplianceRule(
        id="AAA-01",
        title="Centralized AAA authentication enabled",
        description=(
            "Management authentication is delegated to a centralized AAA service. "
            "Detection only on ios/nxos/eos — their remediation commands have no "
            "safe local-user fallback, so auto-applying them risks locking out "
            "every future login. Apply manually with a verified fallback in place."
        ),
        severity="high",
        pci_dss=("7.2.1", "8.2.1"),
        iso27001=("A.5.16", "A.8.2"),
        platforms={
            "ios": PlatformCheck(
                match=r"^aaa new-model",
            ),
            "nxos": PlatformCheck(
                match=r"^aaa authentication login default group\b",
            ),
            "junos": PlatformCheck(
                match=r"^set system authentication-order\b",
                remediation="set system authentication-order [radius password]",
            ),
            "eos": PlatformCheck(
                match=r"^aaa authentication login default group\b",
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
            "eos": PlatformCheck(
                match=r"^snmp-server community (public|private)\b",
                expect=False,
                remediation="no snmp-server community public\nno snmp-server community private",
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
            "eos": PlatformCheck(
                match=r"^snmp-server community \S+ [Rr][Ww]\b",
                expect=False,
                remediation="! review and remove manually: no snmp-server community <name> RW",
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

    `variables` is the device's effective compliance profile (e.g.
    {"ntp_server": "10.0.0.1", "password_min_length": 12, ...}). A rule whose
    required variable(s) are missing/empty is reported as "skipped".

    Variables in MULTI_VALUE_VARIABLES may hold a comma-separated list: the
    rule passes only when every value is present, and remediation covers only
    the missing ones.
    """
    plat = normalize_platform(platform)
    lines = config_text.splitlines()
    results: list[RuleResult] = []

    def first_match(pattern: re.Pattern[str]) -> str:
        for line in lines:
            if pattern.search(line):
                return line.strip()
        return ""

    for rule in RULES:
        check = rule.platforms.get(plat) if plat else None
        if check is None:
            results.append(RuleResult(rule.id, "not_applicable"))
            continue

        missing = [
            v
            for v in rule.variables
            if not variables.get(v)
            or (v in MULTI_VALUE_VARIABLES and not split_values(variables.get(v)))
        ]
        if missing:
            results.append(
                RuleResult(
                    rule.id,
                    "skipped",
                    evidence=f"Missing profile variable(s): {', '.join(missing)}",
                )
            )
            continue

        # At most one multi-value variable per rule is supported; a rule with
        # two would fall back to matching the raw comma string.
        multi_vars = [v for v in rule.variables if v in MULTI_VALUE_VARIABLES]
        multi_var = multi_vars[0] if len(multi_vars) == 1 else None
        values = split_values(variables[multi_var]) if multi_var else []

        base_match_fmt = {
            v: re.escape(str(variables[v])) for v in rule.variables if v != multi_var
        }
        base_rem_fmt = {v: str(variables[v]) for v in rule.variables if v != multi_var}

        present_lines: list[str] = []
        absent: list[str] = []
        try:
            if multi_var is None:
                matched_line = first_match(
                    re.compile(check.match.format(**base_match_fmt))
                )
                if matched_line:
                    present_lines.append(matched_line)
            else:
                for value in values:
                    pattern = re.compile(
                        check.match.format(
                            **base_match_fmt, **{multi_var: re.escape(value)}
                        )
                    )
                    matched_line = first_match(pattern)
                    if matched_line:
                        if matched_line not in present_lines:
                            present_lines.append(matched_line)
                    else:
                        absent.append(value)
        except re.error as exc:
            results.append(RuleResult(rule.id, "error", evidence=str(exc)))
            continue

        found = bool(present_lines)
        # Single-value rules have no `absent` entries, so "all present" is
        # simply "found".
        all_present = found if multi_var is None else not absent
        passed = all_present if check.expect else not found
        if passed:
            evidence = "; ".join(present_lines) if check.expect else ""
            results.append(RuleResult(rule.id, "pass", evidence=evidence))
            continue

        remediation = ""
        if check.remediation:
            if multi_var is None:
                remediation = check.remediation.format(**base_rem_fmt)
            else:
                remediation = "\n".join(
                    check.remediation.format(**base_rem_fmt, **{multi_var: value})
                    for value in absent
                )

        if not check.expect:
            evidence = present_lines[0] if present_lines else ""
        elif absent:
            evidence = f"Missing: {', '.join(absent)}"
            if present_lines:
                evidence += f" | Found: {'; '.join(present_lines)}"
        else:
            evidence = ""
        results.append(
            RuleResult(
                rule.id, "fail", evidence=evidence, remediation_commands=remediation
            )
        )

    return results
