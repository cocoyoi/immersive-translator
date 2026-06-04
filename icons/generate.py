#!/usr/bin/env python3
"""Generate immersive-translator extension icons."""

from PIL import Image, ImageDraw, ImageFont
import math

# Colors matching popup theme
BG_TOP = (102, 126, 234)      # #667eea
BG_BOTTOM = (118, 75, 162)    # #764ba2
WHITE = (255, 255, 255)

def rounded_rect(size, radius_ratio=0.22):
    """Create a rounded rectangle mask."""
    img = Image.new('RGBA', size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    r = int(min(size) * radius_ratio)
    draw.rounded_rectangle([0, 0, size[0]-1, size[1]-1], radius=r, fill=(255,255,255,255))
    return img

def gradient_bg(size, top, bottom):
    """Create a vertical gradient background."""
    img = Image.new('RGB', size)
    for y in range(size[1]):
        ratio = y / size[1]
        r = int(top[0] + (bottom[0] - top[0]) * ratio)
        g = int(top[1] + (bottom[1] - top[1]) * ratio)
        b = int(top[2] + (bottom[2] - top[2]) * ratio)
        for x in range(size[0]):
            img.putpixel((x, y), (r, g, b))
    return img

def draw_icon(size, output_path):
    """Draw the immersive-translator icon at given size."""
    bg = gradient_bg(size, BG_TOP, BG_BOTTOM)
    
    # Convert to RGBA for compositing
    icon = bg.convert('RGBA')
    draw = ImageDraw.Draw(icon)
    
    s = min(size)
    cx, cy = size[0] // 2, size[1] // 2
    
    if size[0] >= 48:
        # Draw a stylized "T" with bilingual dots
        # Main T vertical bar
        bar_w = max(2, s // 10)
        bar_h = int(s * 0.45)
        
        # Horizontal top of T
        top_w = int(s * 0.55)
        top_h = max(2, s // 10)
        top_y = cy - bar_h // 2
        
        draw.rounded_rectangle(
            [cx - top_w//2, top_y, cx + top_w//2, top_y + top_h],
            radius=max(1, top_h//2), fill=WHITE
        )
        
        draw.rounded_rectangle(
            [cx - bar_w//2, top_y, cx + bar_w//2, top_y + bar_h],
            radius=max(1, bar_w//2), fill=WHITE
        )
        
        # Small dots on sides representing bilingual/dual language
        dot_r = max(2, s // 16)
        left_dot_x = cx - top_w//2 - dot_r - s//20
        right_dot_x = cx + top_w//2 + dot_r + s//20
        dot_y = cy
        
        draw.ellipse([left_dot_x - dot_r, dot_y - dot_r, left_dot_x + dot_r, dot_y + dot_r], fill=WHITE)
        draw.ellipse([right_dot_x - dot_r, dot_y - dot_r, right_dot_x + dot_r, dot_y + dot_r], fill=(255,255,255,180))
        
        # Small arc connecting them (subtle)
        if size[0] >= 128:
            arc_y = cy + bar_h//3
            draw.arc([left_dot_x, arc_y - s//20, right_dot_x, arc_y + s//20], start=0, end=180, fill=(255,255,255,120), width=max(1, s//80))
    else:
        # 16x16 simplified - just T
        bar_w = max(2, s // 8)
        bar_h = int(s * 0.5)
        top_w = int(s * 0.6)
        top_h = max(2, s // 8)
        top_y = cy - bar_h // 2
        
        draw.rectangle([cx - top_w//2, top_y, cx + top_w//2, top_y + top_h], fill=WHITE)
        draw.rectangle([cx - bar_w//2, top_y, cx + bar_w//2, top_y + bar_h], fill=WHITE)
    
    # Apply rounded mask
    mask = rounded_rect(size)
    icon.putalpha(mask.split()[3])
    
    # For small icons, also save without full alpha edge for crispness
    if size[0] == 16:
        icon = icon.convert('RGBA')
    
    icon.save(output_path, 'PNG')
    print(f"Generated {output_path} ({size[0]}x{size[1]})")

# Generate all three sizes
draw_icon((16, 16), '/root/.openclaw/workspace/immersive-translator/icons/icon16.png')
draw_icon((48, 48), '/root/.openclaw/workspace/immersive-translator/icons/icon48.png')
draw_icon((128, 128), '/root/.openclaw/workspace/immersive-translator/icons/icon128.png')

print("All icons generated successfully.")
