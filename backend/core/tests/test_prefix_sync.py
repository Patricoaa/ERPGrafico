"""
Tests to detect drift between EntityPrefix, UniversalRegistry templates,
and frontend ENTITY_REGISTRY.
"""

import pytest
from core.prefix_registry import EntityPrefix
from core.registry import UniversalRegistry


@pytest.mark.django_db
class TestPrefixSync:
    def test_every_registered_template_uses_valid_prefix(self):
        """
        Every UniversalRegistry short_display_template should reference
        a value from the EntityPrefix enum.
        """
        prefix_values = {m.value for m in EntityPrefix}
        for entity in UniversalRegistry._entities.values():
            template = entity.short_display_template
            # Extract the prefix portion before the first '{'
            prefix_candidate = template.split("{")[0].rstrip("- ")
            if prefix_candidate and prefix_candidate not in prefix_values:
                pytest.fail(
                    f"Entity '{entity.label}' has template '{template}' "
                    f"but prefix '{prefix_candidate}' is not in EntityPrefix. "
                    f"Known prefixes: {prefix_values}"
                )

    def test_entity_config_endpoint_returns_all_registered(self):
        """
        The /api/core/entity-config/ view should return data for every
        registered SearchableEntity.
        """
        configs = UniversalRegistry.all_entities_serializable()
        registered_labels = set(UniversalRegistry.all_labels())
        returned_labels = {c["label"] for c in configs}
        assert returned_labels == registered_labels, (
            f"Missing: {registered_labels - returned_labels}. "
            f"Extra: {returned_labels - registered_labels}"
        )

    def test_entity_config_includes_prefix(self):
        """
        Every entity config should have a non-empty prefix string when
        its shortTemplate starts with a known prefix pattern.
        """
        configs = UniversalRegistry.all_entities_serializable()
        for c in configs:
            if c["shortTemplate"].startswith("{"):
                continue  # no fixed prefix (e.g. account.code)
            if not c["prefix"]:
                pytest.fail(
                    f"Entity '{c['label']}' has shortTemplate '{c['shortTemplate']}' "
                    f"but no matching EntityPrefix value was found."
                )
