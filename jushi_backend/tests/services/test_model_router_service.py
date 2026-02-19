import unittest

from app.services.model_router_service import model_router_service


class ModelRouterServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.configs = [
            {
                "config_id": "cfg-fast",
                "config_name": "Fast",
                "model_id": "deepseek-chat",
                "api_key": "k1",
                "base_url": "https://example.com/v1",
                "enabled": True,
                "priority": 50,
                "capabilities": ["fast", "classifier"],
                "is_active": True,
            },
            {
                "config_id": "cfg-reasoning",
                "config_name": "Reasoning",
                "model_id": "deepseek-reasoner",
                "api_key": "k2",
                "base_url": "https://example.com/v1",
                "enabled": True,
                "priority": 80,
                "capabilities": ["reasoning"],
                "is_active": False,
            },
            {
                "config_id": "cfg-disabled",
                "config_name": "Disabled",
                "model_id": "gpt-4o-mini",
                "api_key": "k3",
                "base_url": "https://example.com/v1",
                "enabled": False,
                "priority": 1,
                "capabilities": ["fast"],
                "is_active": False,
            },
        ]

    def test_pick_classifier_prefers_classifier_capability(self) -> None:
        selected = model_router_service.pick_classifier_config(self.configs, "cfg-fast")
        self.assertIsNotNone(selected)
        self.assertEqual(selected.get("config_id"), "cfg-fast")

    def test_pick_main_prefers_reasoning_for_hard_thinking_task(self) -> None:
        selected = model_router_service.pick_main_config(
            task_type="thinking",
            difficulty_level=5,
            route_mode="auto",
            configs=self.configs,
            active_id="cfg-fast",
        )
        self.assertIsNotNone(selected)
        self.assertEqual(selected.get("config_id"), "cfg-reasoning")

    def test_pick_main_fast_mode_forces_fast_model(self) -> None:
        selected = model_router_service.pick_main_config(
            task_type="thinking",
            difficulty_level=5,
            route_mode="fast",
            configs=self.configs,
            active_id="cfg-fast",
        )
        self.assertIsNotNone(selected)
        self.assertEqual(selected.get("config_id"), "cfg-fast")

    def test_pick_fallback_excludes_main(self) -> None:
        main = self.configs[0]
        selected = model_router_service.pick_fallback_config(main, self.configs, prefer_reasoning=True)
        self.assertIsNotNone(selected)
        self.assertNotEqual(selected.get("config_id"), main.get("config_id"))


if __name__ == "__main__":
    unittest.main()
