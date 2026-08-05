from app.automation.compliance_rules import (
    RULES,
    evaluate_rules,
    normalize_platform,
    split_values,
)

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

EOS_HARDENED = """
ntp server 10.0.0.1
logging host 10.0.0.2
ip name-server 10.0.0.3
aaa authentication policy lockout failure 5 window 60 duration 120
banner motd ^C Unauthorized access is prohibited. ^C
aaa authentication login default group radius
management security
 password minimum length 12
line vty 0 15
 exec-timeout 10 0
"""

BARE_CONFIG = "hostname r1\n"


def _status_map(config_text: str, platform: str, variables: dict) -> dict[str, str]:
    return {
        r.rule_id: r.status for r in evaluate_rules(config_text, platform, variables)
    }


def test_normalize_platform():
    assert normalize_platform("ios") == "ios"
    assert normalize_platform("nxos_ssh") == "nxos"
    assert normalize_platform("nxos") == "nxos"
    assert normalize_platform("junos") == "junos"
    assert normalize_platform("eos") == "eos"
    assert normalize_platform(None) is None


def test_ios_hardened_config_passes_every_applicable_rule():
    statuses = _status_map(IOS_HARDENED, "ios", VARIABLES)
    for rule in RULES:
        if "ios" not in rule.platforms:
            assert statuses[rule.id] == "not_applicable"
        else:
            assert statuses[rule.id] == "pass", f"{rule.id} expected pass"


def test_ios_ssh_operational_evidence_passes_ssh01():
    """Cisco IOS operational output 'SSH Enabled - version 2.0' satisfies SSH-01 even if omitted from running-config."""
    config = "hostname r1\nSSH Enabled - version 2.0\nAuthentication methods:publickey,keyboard-interactive,password"
    results = {r.rule_id: r for r in evaluate_rules(config, "ios", VARIABLES)}
    assert results["SSH-01"].status == "pass"
    assert results["SSH-01"].evidence == "SSH Enabled - version 2.0"


def test_ios_vty_0_4_passes_timeout01():
    """Devices with 'line vty 0 4' instead of 'line vty 0 15' pass TIMEOUT-01 when exec-timeout is configured."""
    config = "line vty 0 4\n exec-timeout 10 0\nline con 0\n exec-timeout 10 0"
    results = {r.rule_id: r for r in evaluate_rules(config, "ios", VARIABLES)}
    assert results["TIMEOUT-01"].status == "pass"
    assert results["TIMEOUT-01"].evidence == "exec-timeout 10 0"


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


def test_junos_tacplus_authentication_order_passes_aaa01():
    """JunOS configured with TACACS+ (tacplus) in authentication-order passes AAA-01."""
    config = "set system authentication-order [ tacplus password ]"
    results = {r.rule_id: r for r in evaluate_rules(config, "junos", VARIABLES)}
    assert results["AAA-01"].status == "pass"
    assert results["AAA-01"].evidence == "set system authentication-order [ tacplus password ]"


def test_eos_hardened_config_passes_every_applicable_rule():
    statuses = _status_map(EOS_HARDENED, "eos", VARIABLES)
    for rule in RULES:
        if "eos" not in rule.platforms:
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


def test_single_value_fail_evidence_shows_missing_command():
    """A single-value/no-variable rule's `absent` list is always empty (only
    multi-value rules populate it), so without a fallback the evidence cell
    is blank on every such failure — assert it instead shows what's missing."""
    results = {r.rule_id: r for r in evaluate_rules(BARE_CONFIG, "ios", VARIABLES)}
    assert results["SSH-01"].status == "fail"
    assert results["SSH-01"].evidence == "Missing: ip ssh version 2"
    assert results["PWD-02"].status == "fail"
    assert results["PWD-02"].evidence == "Missing: security passwords min-length 12"


def test_check_only_rule_fail_evidence_has_no_command():
    """AAA-01 on ios has no remediation (check-only), so the fallback can't
    quote a command — it should say plainly that nothing matched."""
    results = {r.rule_id: r for r in evaluate_rules(BARE_CONFIG, "ios", VARIABLES)}
    assert results["AAA-01"].status == "fail"
    assert results["AAA-01"].evidence == "No matching configuration line found"


def test_aaa01_is_check_only_on_all_platforms():
    """AAA-01 remediation is check-only across all platforms (ios/nxos/eos/junos),
    so it must never auto-generate remediation commands even when failing."""
    for platform in ("ios", "nxos_ssh", "eos", "junos"):
        results = {
            r.rule_id: r for r in evaluate_rules(BARE_CONFIG, platform, VARIABLES)
        }
        assert results["AAA-01"].status == "fail"
        assert results["AAA-01"].remediation_commands == ""


def test_split_values_helper():
    assert split_values(None) == []
    assert split_values("") == []
    assert split_values("10.0.0.1") == ["10.0.0.1"]
    assert split_values("10.0.0.1,10.0.0.4") == ["10.0.0.1", "10.0.0.4"]
    assert split_values(" 10.0.0.1 , 10.0.0.4 ,, 10.0.0.1 ") == ["10.0.0.1", "10.0.0.4"]
    assert split_values(12) == ["12"]


def _results(config_text: str, platform: str, variables: dict) -> dict:
    return {r.rule_id: r for r in evaluate_rules(config_text, platform, variables)}


def test_multi_value_all_present_passes():
    variables = dict(VARIABLES, ntp_server="10.0.0.1, 10.0.0.4")
    config = IOS_HARDENED + "ntp server 10.0.0.4\n"
    result = _results(config, "ios", variables)["NTP-01"]
    assert result.status == "pass"
    assert "10.0.0.1" in result.evidence
    assert "10.0.0.4" in result.evidence


def test_multi_value_partial_match_fails_and_remediates_only_missing():
    variables = dict(VARIABLES, ntp_server="10.0.0.1, 10.0.0.4")
    result = _results(IOS_HARDENED, "ios", variables)["NTP-01"]
    assert result.status == "fail"
    assert result.remediation_commands == "ntp server 10.0.0.4"
    assert "10.0.0.1" not in result.remediation_commands
    assert "Missing: 10.0.0.4" in result.evidence
    assert "Found: ntp server 10.0.0.1" in result.evidence


def test_multi_value_whitespace_and_dedup():
    variables = dict(VARIABLES, ntp_server=" 10.0.0.1 ,10.0.0.1 , 10.0.0.4 ")
    result = _results(IOS_HARDENED, "ios", variables)["NTP-01"]
    assert result.remediation_commands == "ntp server 10.0.0.4"


def test_multi_value_syslog_two_missing_emits_two_lines():
    variables = dict(VARIABLES, syslog_server="10.0.0.2,10.0.0.9")
    result = _results(BARE_CONFIG, "ios", variables)["LOG-01"]
    assert result.status == "fail"
    assert result.remediation_commands == "logging host 10.0.0.2\nlogging host 10.0.0.9"


def test_multi_value_dns_single_line_with_both_servers_passes():
    variables = dict(VARIABLES, dns_server="10.0.0.3,10.0.0.4")
    config = "ip name-server 10.0.0.3 10.0.0.4\n"
    result = _results(config, "ios", variables)["DNS-01"]
    assert result.status == "pass"
    # both values match the same line — evidence must not repeat it
    assert result.evidence == "ip name-server 10.0.0.3 10.0.0.4"


def test_whitespace_only_multi_value_is_skipped():
    variables = dict(VARIABLES, ntp_server="  ,  ")
    result = _results(BARE_CONFIG, "ios", variables)["NTP-01"]
    assert result.status == "skipped"
    assert "ntp_server" in result.evidence


def test_int_variables_are_never_split():
    hardened = _results(IOS_HARDENED, "ios", VARIABLES)
    assert hardened["PWD-02"].status == "pass"
    assert hardened["TIMEOUT-01"].status == "pass"
    bare = _results(BARE_CONFIG, "ios", VARIABLES)
    assert bare["PWD-02"].remediation_commands == "security passwords min-length 12"


def test_multi_value_junos_and_eos():
    junos_vars = dict(VARIABLES, ntp_server="10.0.0.1,10.0.0.4")
    junos = _results(JUNOS_HARDENED, "junos", junos_vars)["NTP-01"]
    assert junos.status == "fail"
    assert junos.remediation_commands == "set system ntp server 10.0.0.4"

    eos_vars = dict(VARIABLES, syslog_server="10.0.0.2,10.0.0.9")
    eos = _results(EOS_HARDENED, "eos", eos_vars)["LOG-01"]
    assert eos.status == "fail"
    assert eos.remediation_commands == "logging host 10.0.0.9"


def test_unsupported_platform_is_not_applicable_for_all_rules():
    statuses = _status_map(IOS_HARDENED, "iosxr", VARIABLES)
    assert all(status == "not_applicable" for status in statuses.values())
