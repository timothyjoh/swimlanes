import { test, expect } from '@playwright/test';

test.describe('Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    // Create a fresh board with a column and cards
    await page.goto('/');
    const boardName = `KB Test Board ${Date.now()}`;
    await page.getByPlaceholder('New board name').fill(boardName);
    await page.getByRole('button', { name: 'Create Board' }).click();
    await page.getByRole('link', { name: boardName }).click();
    await expect(page.getByRole('heading', { name: boardName, level: 1 })).toBeVisible();

    // Create a column
    await page.getByPlaceholder('New column name').fill('Test Column');
    await page.getByRole('button', { name: 'Add Column' }).click();
    await expect(page.locator('h3').filter({ hasText: 'Test Column' })).toBeVisible();
  });

  test('arrow keys navigate between cards', async ({ page }) => {
    const column = page.locator('div.w-72').filter({ hasText: 'Test Column' });

    // Create 3 cards
    for (const title of ['Card 1', 'Card 2', 'Card 3']) {
      await column.getByPlaceholder('Add a card...').fill(title);
      await column.getByRole('button', { name: 'Add Card' }).click();
      await expect(column.locator('.font-medium').filter({ hasText: title })).toBeVisible();
    }

    // Focus the first card
    const card1 = column.locator('[data-card-id]').filter({ hasText: 'Card 1' });
    await card1.focus();
    await expect(card1).toBeFocused();

    // Arrow down to Card 2
    await page.keyboard.press('ArrowDown');
    const card2 = column.locator('[data-card-id]').filter({ hasText: 'Card 2' });
    await expect(card2).toBeFocused();

    // Arrow down to Card 3
    await page.keyboard.press('ArrowDown');
    const card3 = column.locator('[data-card-id]').filter({ hasText: 'Card 3' });
    await expect(card3).toBeFocused();

    // Arrow down on last card does nothing
    await page.keyboard.press('ArrowDown');
    await expect(card3).toBeFocused();

    // Arrow up back to Card 2
    await page.keyboard.press('ArrowUp');
    await expect(card2).toBeFocused();

    // Arrow up back to Card 1
    await page.keyboard.press('ArrowUp');
    await expect(card1).toBeFocused();

    // Arrow up on first card does nothing
    await page.keyboard.press('ArrowUp');
    await expect(card1).toBeFocused();
  });

  test('Enter key starts editing a card', async ({ page }) => {
    const column = page.locator('div.w-72').filter({ hasText: 'Test Column' });

    // Create a card
    await column.getByPlaceholder('Add a card...').fill('Editable Card');
    await column.getByRole('button', { name: 'Add Card' }).click();
    await expect(column.locator('.font-medium').filter({ hasText: 'Editable Card' })).toBeVisible();

    // Focus the card and press Enter
    const card = column.locator('[data-card-id]').filter({ hasText: 'Editable Card' });
    await card.focus();
    await expect(card).toBeFocused();
    // Wait for React re-render after focus state change
    await expect(card).toHaveClass(/ring-2/);
    await card.press('Enter');

    // Verify edit mode is active (Save button visible)
    await expect(column.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(column.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('Escape key cancels editing a card', async ({ page }) => {
    const column = page.locator('div.w-72').filter({ hasText: 'Test Column' });

    // Create a card
    await column.getByPlaceholder('Add a card...').fill('Cancel Card');
    await column.getByRole('button', { name: 'Add Card' }).click();
    await expect(column.locator('.font-medium').filter({ hasText: 'Cancel Card' })).toBeVisible();

    // Click to enter edit mode
    await column.locator('.font-medium').filter({ hasText: 'Cancel Card' }).click();
    await expect(column.getByRole('button', { name: 'Save' })).toBeVisible();

    // Press Escape on the input to cancel
    await page.keyboard.press('Escape');

    // Verify edit mode is closed
    await expect(column.getByRole('button', { name: 'Save' })).not.toBeVisible();
    await expect(column.locator('.font-medium').filter({ hasText: 'Cancel Card' })).toBeVisible();
  });

  test('Delete key deletes a card with confirmation', async ({ page }) => {
    const column = page.locator('div.w-72').filter({ hasText: 'Test Column' });

    // Create a card
    await column.getByPlaceholder('Add a card...').fill('Delete Me');
    await column.getByRole('button', { name: 'Add Card' }).click();
    await expect(column.locator('.font-medium').filter({ hasText: 'Delete Me' })).toBeVisible();

    // Set up dialog handler
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Delete');
      await dialog.accept();
    });

    // Focus card and press Delete
    const card = column.locator('[data-card-id]').filter({ hasText: 'Delete Me' });
    await card.focus();
    await page.keyboard.press('Delete');

    // Verify card is deleted
    await expect(column.locator('.font-medium').filter({ hasText: 'Delete Me' })).not.toBeVisible();
  });

  test('Enter key starts editing a column name', async ({ page }) => {
    // Focus the column and press Enter
    const column = page.locator('div.w-72').filter({ hasText: 'Test Column' });
    await column.focus();
    await page.keyboard.press('Enter');

    // Verify edit mode is active (input with blue border visible)
    await expect(page.locator('input[type="text"][class*="border-blue"]')).toBeVisible();
  });

  test('Delete key deletes a column with confirmation', async ({ page }) => {
    // Set up dialog handler
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Focus the column and press Delete
    const column = page.locator('div.w-72').filter({ hasText: 'Test Column' });
    await column.focus();
    await page.keyboard.press('Delete');

    // Verify column is deleted
    await expect(page.locator('h3').filter({ hasText: 'Test Column' })).not.toBeVisible();
  });

  test('focus indicators are visible on cards', async ({ page }) => {
    const column = page.locator('div.w-72').filter({ hasText: 'Test Column' });

    // Create a card
    await column.getByPlaceholder('Add a card...').fill('Focus Card');
    await column.getByRole('button', { name: 'Add Card' }).click();
    await expect(column.locator('.font-medium').filter({ hasText: 'Focus Card' })).toBeVisible();

    // Focus the card
    const card = column.locator('[data-card-id]').filter({ hasText: 'Focus Card' });
    await card.focus();

    // Verify focus ring is applied (ring-2 ring-blue-500 classes)
    await expect(card).toHaveClass(/ring-2/);
    await expect(card).toHaveClass(/ring-blue-500/);
  });
});
