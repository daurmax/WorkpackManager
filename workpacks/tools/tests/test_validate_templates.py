import json
import sys
import unittest
from pathlib import Path

import jsonschema


TOOLS_DIR = Path(__file__).resolve().parents[1]
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import validate_templates as templates  # noqa: E402


class ValidateTemplatesConfigSchemaTests(unittest.TestCase):
    def _load_config_schema(self) -> dict:
        schema_path = templates.SCHEMA_FILES["config"]
        return json.loads(schema_path.read_text(encoding="utf-8"))

    def test_config_schema_is_registered_and_valid(self) -> None:
        self.assertIn("config", templates.SCHEMA_FILES)
        errors: list[str] = []
        schemas = templates.validate_schemas(errors)
        self.assertIn("config", schemas)
        self.assertEqual(errors, [])

    def test_config_schema_is_draft_2020_12_valid(self) -> None:
        schema = self._load_config_schema()
        jsonschema.Draft202012Validator.check_schema(schema)

    def test_config_schema_accepts_valid_payload(self) -> None:
        schema = self._load_config_schema()
        payload = {
            "workpackDir": "workpacks",
            "verifyCommands": {
                "build": "npm run build",
                "test": "npm test",
                "lint": "npm run lint",
            },
            "protocolVersion": "2.2.0",
            "strictMode": True,
            "discovery": {
                "roots": ["packages", "services/api"],
                "exclude": ["**/node_modules/**", "**/.git/**"],
            },
        }
        jsonschema.validate(payload, schema)

    def test_config_schema_rejects_unknown_top_level_key(self) -> None:
        schema = self._load_config_schema()
        payload = {"unexpected": True}
        with self.assertRaises(jsonschema.ValidationError):
            jsonschema.validate(payload, schema)

    def test_config_schema_rejects_wrong_types(self) -> None:
        schema = self._load_config_schema()

        with self.assertRaises(jsonschema.ValidationError):
            jsonschema.validate({"strictMode": "true"}, schema)

        with self.assertRaises(jsonschema.ValidationError):
            jsonschema.validate({"verifyCommands": {"build": 123}}, schema)

        with self.assertRaises(jsonschema.ValidationError):
            jsonschema.validate({"discovery": {"roots": ["ok", 3]}}, schema)

    def test_config_schema_rejects_unknown_nested_keys(self) -> None:
        schema = self._load_config_schema()

        with self.assertRaises(jsonschema.ValidationError):
            jsonschema.validate({"verifyCommands": {"deploy": "npm run deploy"}}, schema)

        with self.assertRaises(jsonschema.ValidationError):
            jsonschema.validate({"discovery": {"ignored": []}}, schema)


if __name__ == "__main__":
    unittest.main()
