from app.automation.compliance_rules import RULES, evaluate_rules, normalize_platform

VARIABLES = {
    "ntp_server": "10.0.0.1",
    "syslog_server": "10.0.0.2",
    "dns_server": "10.0.0.3",
    "password_min_length": 12,
    "exec_timeout_minutes": 10,
}

IOS_HARDENED = """
service timestamps log datetime msec localtime show-timezone
service password-encryption
ntp server 10.0.0.1
logging host 10.0.0.2
ip name-server 10.0.0.3
ip ssh version 2
no ip http server
security passwords min-length 12
login block-for 120 attempts 5 within 60
banner motd ^C Unauthorized access is prohibited. ^C
aaa new-model
line vty 0 15
 exec-timeout 10 0
 transport input ssh
line con 0
 exec-timeout 10 0
"""

NXOS_HARDENED = """
ntp server 10.0.0.1
logging server 10.0.0.2
ip name-server 10.0.0.3
feature ssh
password strength-check
login block-for 120 attempts 5 within 60
banner motd ^C Unauthorized access is prohibited. ^C
aaa authentication login default group radius
line vty
 exec-timeout 10
"""

JUNOS_HARDENED = """
set system ntp server 10.0.0.1
set system syslog host 10.0.0.2
set system name-server 10.0.0.3
set system services ssh protocol-version v2
set system login password minimum-length 12
set system login retry-options tries-before-disconnect 3
set system login message "Unauthorized access is prohibited."
set system authentication-order [radius password]
set system login class ops idle-timeout 10
"""

BARE_CONFIG = "hostname r1\n"


def _status_map(config_text: str, platform: str, variables: dict) -> dict[str, str]:
    return {r.rule_id: r.status for r in evaluate_rules(config_text, platform, variables)}


def test_normalize_platform():
    assert normalize_platform("ios") == "ios"
    assert normalize_platform("nxos_ssh") == "nxos"
    assert normalize_platform("nxos") == "nxos"
    assert normalize_platform("junos") == "junos"
    assert normalize_platform("eos") is None
    assert normalize_platform(None) is None


def test_ios_hardened_config_passes_every_applicable_rule():
    statuses = _status_map(IOS_HARDENED, "ios", VARIABLES)
    for rule in RULES:
        if "ios" not in rule.platforms:
            assert statuses[rule.id] == "not_applicable"
        else:
            assert statuses[rule.id] == "pass", f"{rule.id} expected pass"


def test_nxos_hardened_config_passes_every_applicable_rule():
    statuses = _status_map(NXOS_HARDENED, "nxos_ssh", VARIABLES)
    for rule in RULES:
        if "nxos" not in rule.platforms:
            assert statuses[rule.id] == "not_applicable"
        else:
            assert statuses[rule.id] == "pass", f"{rule.id} expected pass"


def test_junos_hardened_config_passes_every_applicable_rule():
    statuses = _status_map(JUNOS_HARDENED, "junos", VARIABLES)
    for rule in RULES:
        if "junos" not in rule.platforms:
            assert statuses[rule.id] == "not_applicable"
        else:
            assert statuses[rule.id] == "pass", f"{rule.id} expected pass"


def test_bare_config_fails_positive_checks_and_passes_absence_checks():
    statuses = _status_map(BARE_CONFIG, "ios", VARIABLES)
    assert statuses["NTP-01"] == "fail"
    assert statuses["LOG-01"] == "fail"
    assert statuses["AAA-01"] == "fail"
    # expect-absent rules pass trivially on an empty config
    assert statuses["VTY-01"] == "pass"
    assert statuses["HTTP-01"] == "pass"
    assert statuses["SNMP-01"] == "pass"
    assert statuses["SNMP-02"] == "pass"


def test_missing_variable_is_skipped_not_failed():
    variables = dict(VARIABLES)
    del variables["ntp_server"]
    results = {r.rule_id: r for r in evaluate_rules(BARE_CONFIG, "ios", variables)}
    assert results["NTP-01"].status == "skipped"
    assert "ntp_server" in results["NTP-01"].evidence


def test_fail_renders_remediation_commands():
    results = {r.rule_id: r for r in evaluate_rules(BARE_CONFIG, "ios", VARIABLES)}
    ntp_result = results["NTP-01"]
    assert ntp_result.status == "fail"
    assert ntp_result.remediation_commands == "ntp server 10.0.0.1"


def test_expect_absent_fail_captures_offending_line():
    config = "snmp-server community public RO\n"
    results = {r.rule_id: r for r in evaluate_rules(config, "ios", VARIABLES)}
    assert results["SNMP-01"].status == "fail"
    assert results["SNMP-01"].evidence == "snmp-server community public RO"


def test_unsupported_platform_is_not_applicable_for_all_rules():
    statuses = _status_map(IOS_HARDENED, "eos", VARIABLES)
    assert all(status == "not_applicable" for status in statuses.values())
