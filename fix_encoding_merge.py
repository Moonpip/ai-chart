# -*- coding: utf-8 -*-
"""Restore ima.html from backup (correct Japanese) and re-apply modifications."""
import os
import sys

BACKUP = r"e:\A\your_project_root\project\05Python\xe3\x83\x97\xe3\x83\xad\xe3\x82\xb8\xe3\x82\xa7\xe3\x82\xaf\xe3\x83\x88\1\ima.html"
# Alternative: use path with actual chars if the above fails
BACKUP_ALT = os.path.join(r"e:\A\your_project_root\project", "05Python\xe3\x83\x97\xe3\x83\xad\xe3\x82\xb8\xe3\x82\xa7\xe3\x82\xaf\xe3\x83\x88", "1", "ima.html")

TARGET = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ima.html")

def main():
    backup_paths = [
        r"e:\A\your_project_root\project\05Python\xe3\x83\x97\xe3\x83\xad\xe3\x82\xb8\xe3\x82\xa7\xe3\x82\xaf\xe3\x83\x88\1\ima.html",
        r"e:\A\your_project_root\project\05Python \u30d7\u30ed\u30b8\u30a7\u30af\u30c8\1\ima.html",
    ]
    # Try literal path with Japanese
    import glob
    base = r"e:\A\your_project_root\project"
    if os.path.exists(base):
        for root, dirs, files in os.walk(base):
            if "ima.html" in files:
                p = os.path.join(root, "ima.html")
                # Prefer path containing 05Python and 1
                if "05Python" in root and "1" in root:
                    backup_paths.insert(0, p)
    backup = None
    for p in backup_paths:
        try:
            if os.path.isfile(p):
                backup = p
                break
        except Exception:
            pass
    if not backup or not os.path.isfile(backup):
        # Fallback: search
        for root, dirs, files in os.walk(r"e:\A\your_project_root\project"):
            for f in files:
                if f == "ima.html" and "1" in root:
                    backup = os.path.join(root, f)
                    break
            if backup:
                break
    if not backup:
        print("Backup not found")
        return 1

    with open(backup, "r", encoding="utf-8") as f:
        content = f.read()

    # Apply modifications (only if not present)
    mods = 0

    # 1. FUTURE_PADDING_BARS
    if "FUTURE_PADDING_BARS" not in content and "const SCROLL_EXTRA = 4;" in content:
        content = content.replace(
            "const SCROLL_EXTRA = 4;\n\n      function visCountFor",
            "const SCROLL_EXTRA = 4;\n\n      // ===== future scroll space =====\n      window.FUTURE_PADDING_BARS = 12;\n\n      function visCountFor"
        )
        mods += 1
        print("Added FUTURE_PADDING_BARS")

    # 2. clampOffset
    if "totalBarsWithFuture" not in content and 'const maxScroll = maxOffset + SCROLL_EXTRA;\n\n        return Math.max(0, Math.min(off, maxScroll));\n      }\n\n      // ===== Future Padding' in content:
        content = content.replace(
            "        const maxOffset = Math.max(0, data.length - vis - RIGHT_MARGIN);\n        const maxScroll = maxOffset + SCROLL_EXTRA;\n\n        return Math.max(0, Math.min(off, maxScroll));",
            "        const totalBars = data.length;\n        const totalBarsWithFuture = totalBars + (window.FUTURE_PADDING_BARS || 0);\n        const maxOffset = Math.max(0, data.length - vis - RIGHT_MARGIN);\n        let maxScroll = maxOffset + SCROLL_EXTRA;\n        maxScroll = Math.max(maxScroll, Math.max(0, totalBarsWithFuture - vis));\n\n        return Math.max(0, Math.min(off, maxScroll));"
        )
        mods += 1
        print("Updated clampOffset")

    # 3. enforceOffsetBounds
    if "totalBarsWithFuture" in content and "enforceOffsetBounds" in content:
        old_enforce = "        const maxOffset = Math.max(0, data.length - visVal - RIGHT_MARGIN);\n        const maxScroll = maxOffset + SCROLL_EXTRA;\n        ST.targetOffset = Math.min(ST.targetOffset, maxScroll);"
        new_enforce = "        const totalBars = data.length;\n        const totalBarsWithFuture = totalBars + (window.FUTURE_PADDING_BARS || 0);\n        const maxOffset = Math.max(0, data.length - visVal - RIGHT_MARGIN);\n        let maxScroll = maxOffset + SCROLL_EXTRA;\n        maxScroll = Math.max(maxScroll, Math.max(0, totalBarsWithFuture - visVal));\n        ST.targetOffset = Math.min(ST.targetOffset, maxScroll);"
        if new_enforce not in content and old_enforce in content:
            content = content.replace(old_enforce, new_enforce)
            mods += 1
            print("Updated enforceOffsetBounds")

    # 4. candlestick loop
    if "index >= data.length" not in content and "for (let i = 0; i < slice.length; i++)" in content:
        needle = "        if (chartType === 'candle') {\n          for (let i = 0; i < slice.length; i++) {\n            const d = slice[i];"
        repl = "        if (chartType === 'candle') {\n          for (let i = 0; i < slice.length; i++) {\n            const index = start + i;\n            if (index >= data.length) continue;\n            const d = slice[i];"
        if needle in content and repl not in content:
            content = content.replace(needle, repl)
            mods += 1
            print("Added candlestick loop check")

    # 5. aiUnifiedForecast (STEP2a) - after first runAIEngine
    if "aiUnifiedForecast" not in content:
        old = "              window.AI = window.runAIEngine(_sliced);\n              window.__lastAIRun = now;\n            }\n          }\n          if (window.AI) {"
        new = "              window.AI = window.runAIEngine(_sliced);\n              window.__lastAIRun = now;\n            }\n            // unified AI forecast\n            window.aiUnifiedForecast = window.computeUnifiedFutureForecast ? window.computeUnifiedFutureForecast(_sliced, 3) : null;\n          }\n          if (window.AI) {"
        if old in content:
            content = content.replace(old, new)
            mods += 1
            print("Added aiUnifiedForecast block1")

    # 6. futureZone override (STEP3a) - before first drawAIOverlay
    if "window.AI.futureZone = {" not in content and "if (window.AI) {" in content:
        old = "          if (window.AI) {\n            const priceLeft = chartLayout.priceLeft ?? 0;"
        new = "          if (window.AI) {\n            if (window.aiUnifiedForecast) {\n              window.AI.futureZone = {\n                upper: window.aiUnifiedForecast.zoneUpper,\n                mid: window.aiUnifiedForecast.zoneMid,\n                lower: window.aiUnifiedForecast.zoneLower,\n                probability: window.aiUnifiedForecast.probability,\n                volatility: window.aiUnifiedForecast.volatility\n              };\n            }\n            const priceLeft = chartLayout.priceLeft ?? 0;"
        if old in content:
            content = content.replace(old, new, 1)
            mods += 1
            print("Added futureZone override block1")

    # 7. drawAIFuturePanel - use aiUnifiedForecast (STEP4)
    if "drawAIFuturePanel(window.AI?.futureDays)" in content and "drawAIFuturePanel(window.aiUnifiedForecast" not in content:
        content = content.replace("window.drawAIFuturePanel(window.AI?.futureDays);", "window.drawAIFuturePanel(window.aiUnifiedForecast || window.AI?.futureDays);")
        mods += 1
        print("drawAIFuturePanel uses aiUnifiedForecast")

    # 8. aiUnifiedForecast block2 (second runAIEngine block)
    old2a = "            window.AI = window.runAIEngine(priceData);\n          }\n        } catch (e) {\n          console.warn('AI Engine error:', e);\n        }\n      }\n\n      /* ======="
    new2a = "            window.AI = window.runAIEngine(priceData);\n            // unified AI forecast\n            window.aiUnifiedForecast = window.computeUnifiedFutureForecast ? window.computeUnifiedFutureForecast(priceData, 3) : null;\n          }\n        } catch (e) {\n          console.warn('AI Engine error:', e);\n        }\n      }\n\n      /* ======="
    if old2a in content and content.count("// unified AI forecast") < 2:
        content = content.replace(old2a, new2a, 1)
        mods += 1
        print("Added aiUnifiedForecast block2")

    # 9. futureZone override block2
    if content.count("window.AI.futureZone = {") < 2:
        old3 = "      if (window.AI && typeof window.drawAIOverlay === 'function') {\n        try {\n          const pl = chartLayout?.priceLeft ?? 0;\n          const pr = chartLayout?.priceRight ?? (canvas.width - dynamicPadR);\n          const lastIdx = (isAtRightEnd && slice.length > 0) ? slice.length : -1;"
        new3 = "      if (window.AI && typeof window.drawAIOverlay === 'function') {\n        try {\n          if (window.aiUnifiedForecast) {\n            window.AI.futureZone = {\n              upper: window.aiUnifiedForecast.zoneUpper,\n              mid: window.aiUnifiedForecast.zoneMid,\n              lower: window.aiUnifiedForecast.zoneLower,\n              probability: window.aiUnifiedForecast.probability,\n              volatility: window.aiUnifiedForecast.volatility\n            };\n          }\n          const pl = chartLayout?.priceLeft ?? 0;\n          const pr = chartLayout?.priceRight ?? (canvas.width - dynamicPadR);\n          const lastIdx = (isAtRightEnd && slice.length > 0) ? slice.length : -1;"
        if old3 in content:
            content = content.replace(old3, new3, 1)
            mods += 1
            print("Added futureZone override block2")

    # 10. aiUnifiedForecast + futureZone block3
    old4 = (
        "            window.AI = window.runAIEngine(priceData);\n          }\n        } catch (e) {\n          console.warn('AI Engine error:', e);\n        }\n      }\n      if (window.AI && typeof window.drawAIOverlay === 'function') {\n        try {\n          const pl = chartLayout?.priceLeft ?? 0;\n          const pr = chartLayout?.priceRight ?? (canvas.width - dynamicPadR);\n          const lastIdx = (typeof isAtRightEnd"
    )
    new4 = (
        "            window.AI = window.runAIEngine(priceData);\n            // unified AI forecast\n            window.aiUnifiedForecast = window.computeUnifiedFutureForecast ? window.computeUnifiedFutureForecast(priceData, 3) : null;\n          }\n        } catch (e) {\n          console.warn('AI Engine error:', e);\n        }\n      }\n      if (window.AI && typeof window.drawAIOverlay === 'function') {\n        try {\n          if (window.aiUnifiedForecast) {\n            window.AI.futureZone = {\n              upper: window.aiUnifiedForecast.zoneUpper,\n              mid: window.aiUnifiedForecast.zoneMid,\n              lower: window.aiUnifiedForecast.zoneLower,\n              probability: window.aiUnifiedForecast.probability,\n              volatility: window.aiUnifiedForecast.volatility\n            };\n          }\n          const pl = chartLayout?.priceLeft ?? 0;\n          const pr = chartLayout?.priceRight ?? (canvas.width - dynamicPadR);\n          const lastIdx = (typeof isAtRightEnd"
    )
    if old4 in content and new4 not in content:
        content = content.replace(old4, new4)
        mods += 1
        print("Added aiUnifiedForecast + futureZone block3")

    with open(TARGET, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)
    print("Saved UTF-8:", TARGET)
    return 0

if __name__ == "__main__":
    sys.exit(main())
