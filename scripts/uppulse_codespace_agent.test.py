#!/usr/bin/env python3
"""Static contract tests; no GitHub auth, Codespaces or DB needed."""
import importlib.util
import json
import pathlib
import unittest
from unittest.mock import patch
FILE=pathlib.Path(__file__).with_name("uppulse_codespace_agent.py")
spec=importlib.util.spec_from_file_location("uppulse_bridge",FILE)
bridge=importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)
class BridgeContract(unittest.TestCase):
 def test_status_only_accepts_empty_body(self):
  self.assertEqual(bridge.parse("STATUS","{}"),{})
  with self.assertRaises(ValueError):bridge.parse("STATUS",'{"command":"rm -rf /"}')
 def test_rejects_shell_injection(self):
  for body in ('{"commit":"$(rm -rf /)"}','{"commit":"aaaa;touch /tmp/bad"}','{"commit":"abcd"}'):
   with self.assertRaises(ValueError):bridge.parse("VALIDAR",body)
 def test_commit_must_be_full_sha(self):
  self.assertEqual(bridge.parse("VALIDAR",'{"commit":"'+"a"*40+'"}')["commit"],"a"*40)
 def test_no_arbitrary_shell_or_urls_in_preview(self):
  p='{"commit":"'+"a"*40+'","port":5011}'
  self.assertEqual(bridge.parse("PREVIEW",p)["port"],5011)
  for bad in ('{"commit":"'+"a"*40+'","port":5000}', '{"commit":"'+"a"*40+'","port":5011,"shell":"id"}'):
   with self.assertRaises(ValueError):bridge.parse("PREVIEW",bad)
 def test_only_own_preview_can_be_stopped(self):
  with patch.object(bridge,"own",return_value=None):
   self.assertIn("no",bridge.stop(5011).lower())
 def test_invalid_boolean_port(self):
  with self.assertRaises(ValueError):bridge.parse("PARAR PREVIEW",'{"port":true}')
 def test_named_profiles_not_commands(self):
  sha="a"*40
  for profile in ("basic","unit","build","ui"):
   result=bridge.parse("VALIDAR",json.dumps({"commit":sha,"profile":profile}))
   self.assertEqual(result["profile"],profile)
  for invalid in ("npm run db:push","shell","other"):
   with self.assertRaises(ValueError):
    bridge.parse("VALIDAR",json.dumps({"commit":sha,"profile":invalid}))
 def test_readonly_actions_allow_no_parameters(self):
  for action in ("STATUS","DIAGNOSTICO","CATALOGO"):
   self.assertEqual(bridge.parse(action,"{}"),{})
   with self.assertRaises(ValueError):
    bridge.parse(action,'{"shell":"exit 0"}')
 def test_explicit_fixed_branch_and_allowed_ports(self):
  self.assertEqual(bridge.BRANCH,"feat/uppulse-missao10-supercatalogo")
  self.assertEqual(bridge.PORTS,{5011,5012,5013,5014,5015})
if __name__=="__main__":unittest.main()
