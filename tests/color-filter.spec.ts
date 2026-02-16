import { test, expect } from '@playwright/test';

test.describe('Color Filtering', () => {
  test.beforeEach(async ({ page }) => {
    // Create fresh board
    await page.goto('/');
    const boardName = `Color Filter Test ${Date.now()}`;
    await page.getByPlaceholder('New board name').fill(boardName);
    await page.getByRole('button', { name: 'Create Board' }).click();
    await page.getByRole('link', { name: boardName }).click();
    await expect(page.getByRole('heading', { name: boardName, level: 1 })).toBeVisible();

    // Create a column
    await page.getByPlaceholder('New column name').fill('Todo');
    await page.getByRole('button', { name: 'Add Column' }).click();
    await expect(page.locator('h3').filter({ hasText: 'Todo' })).toBeVisible();

    const column = page.locator('div.w-72').filter({ hasText: 'Todo' });

    // Create cards with colors
    // Card 1: "Blocker" with red color
    await column.getByPlaceholder('Add a card...').first().fill('Blocker');
    await column.getByRole('button', { name: 'Add Card' }).click();
    await expect(column.locator('text=Blocker')).toBeVisible();
    // Edit card to set color
    await column.locator('text=Blocker').click();
    await column.locator('select').selectOption('red');
    await column.getByRole('button', { name: 'Save' }).click();
    await expect(column.locator('.bg-red-200')).toBeVisible();

    // Card 2: "Feature" with blue color
    await column.getByPlaceholder('Add a card...').first().fill('Feature');
    await column.getByRole('button', { name: 'Add Card' }).click();
    await expect(column.locator('text=Feature')).toBeVisible();
    await column.locator('text=Feature').click();
    await column.locator('select').selectOption('blue');
    await column.getByRole('button', { name: 'Save' }).click();
    await expect(column.locator('.bg-blue-200')).toBeVisible();

    // Card 3: "Done" with green color
    await column.getByPlaceholder('Add a card...').first().fill('Done');
    await column.getByRole('button', { name: 'Add Card' }).click();
    await expect(column.locator('text=Done')).toBeVisible();
    await column.locator('text=Done').click();
    await column.locator('select').selectOption('green');
    await column.getByRole('button', { name: 'Save' }).click();
    await expect(column.locator('.bg-green-200')).toBeVisible();

    // Card 4: "Plain" with no color (keep default)
    await column.getByPlaceholder('Add a card...').first().fill('Plain');
    await column.getByRole('button', { name: 'Add Card' }).click();
    await expect(column.locator('text=Plain')).toBeVisible();
  });

  test('filters by single color', async ({ page }) => {
    await page.getByLabel('Filter by red cards').click();

    await expect(page.locator('[aria-label="Card: Blocker"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Feature"]')).toBeHidden();
    await expect(page.locator('[aria-label="Card: Done"]')).toBeHidden();
    await expect(page.locator('[aria-label="Card: Plain"]')).toBeHidden();
  });

  test('filters by multiple colors (OR logic)', async ({ page }) => {
    await page.getByLabel('Filter by red cards').click();
    await page.getByLabel('Filter by blue cards').click();

    await expect(page.locator('[aria-label="Card: Blocker"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Feature"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Done"]')).toBeHidden();
    await expect(page.locator('[aria-label="Card: Plain"]')).toBeHidden();
  });

  test('combines text search with color filter', async ({ page }) => {
    // Search for "feature" which matches only "Feature"
    // Then filter by blue - should show only "Feature"
    await page.getByLabel('Search cards').fill('feature');
    await page.waitForTimeout(400);
    await page.getByLabel('Filter by blue cards').click();

    await expect(page.locator('[aria-label="Card: Feature"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Blocker"]')).toBeHidden();
    await expect(page.locator('[aria-label="Card: Done"]')).toBeHidden();
  });

  test('clear filters resets both text and color', async ({ page }) => {
    await page.getByLabel('Search cards').fill('test');
    await page.waitForTimeout(400);
    await page.getByLabel('Filter by red cards').click();

    await page.getByRole('button', { name: 'Clear Filters' }).click();

    // All cards should be visible again
    await expect(page.locator('[aria-label="Card: Blocker"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Feature"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Done"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Plain"]')).toBeVisible();

    // Color chip should be deselected
    await expect(page.getByLabel('Filter by red cards')).toHaveAttribute('aria-pressed', 'false');
  });

  test('color filter persists in URL', async ({ page }) => {
    await page.getByLabel('Filter by red cards').click();
    await page.getByLabel('Filter by blue cards').click();

    // Check URL contains colors param
    await expect(page).toHaveURL(/colors=red%2Cblue|colors=red,blue/);
  });

  test('loads color filter from URL on page load', async ({ page }) => {
    // Get current URL and add colors param
    const currentUrl = page.url();
    const separator = currentUrl.includes('?') ? '&' : '?';
    await page.goto(`${currentUrl}${separator}colors=red,blue`);

    // Wait for page to load
    await expect(page.getByLabel('Filter by red cards')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Filter by blue cards')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Filter by green cards')).toHaveAttribute('aria-pressed', 'false');

    // Cards should be filtered
    await expect(page.locator('[aria-label="Card: Blocker"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Feature"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Done"]')).toBeHidden();
  });

  test('deselecting color chip removes filter', async ({ page }) => {
    await page.getByLabel('Filter by red cards').click();

    // Only red card visible
    await expect(page.locator('[aria-label="Card: Blocker"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Feature"]')).toBeHidden();

    // Deselect red
    await page.getByLabel('Filter by red cards').click();

    // All cards visible again
    await expect(page.locator('[aria-label="Card: Blocker"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Feature"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Done"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Plain"]')).toBeVisible();
  });

  test('match count updates with color selection', async ({ page }) => {
    await page.getByLabel('Filter by red cards').click();
    await expect(page.getByText('1 card found')).toBeVisible();

    await page.getByLabel('Filter by blue cards').click();
    await expect(page.getByText('2 cards found')).toBeVisible();
  });

  test('keyboard navigation works with color chips', async ({ page }) => {
    // Tab to the red chip and press Enter
    const redChip = page.getByLabel('Filter by red cards');
    await redChip.focus();
    await page.keyboard.press('Enter');

    await expect(redChip).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[aria-label="Card: Blocker"]')).toBeVisible();
    await expect(page.locator('[aria-label="Card: Feature"]')).toBeHidden();

    // Press Space to deselect
    await page.keyboard.press('Space');
    await expect(redChip).toHaveAttribute('aria-pressed', 'false');
  });

  test('empty state when no cards match color filter', async ({ page }) => {
    await page.getByLabel('Filter by purple cards').click();

    await expect(page.getByText('No matching cards')).toBeVisible();
    await expect(page.getByText('0 cards found')).toBeVisible();
  });

  test('color chips show correct visual selection state', async ({ page }) => {
    const redChip = page.getByLabel('Filter by red cards');

    // Initially not selected
    await expect(redChip).toHaveAttribute('aria-pressed', 'false');

    // Click to select
    await redChip.click();
    await expect(redChip).toHaveAttribute('aria-pressed', 'true');
    // Check for ring class
    await expect(redChip).toHaveClass(/ring-2/);
  });

  test('drag-and-drop works on filtered cards', async ({ page }) => {
    // Create a second column to drag to
    await page.getByPlaceholder('New column name').fill('In Progress');
    await page.getByRole('button', { name: 'Add Column' }).click();
    await expect(page.locator('h3').filter({ hasText: 'In Progress' })).toBeVisible();

    // Filter to show only red cards
    await page.getByLabel('Filter by red cards').click();
    await expect(page.getByLabel('Filter by red cards')).toHaveAttribute('aria-pressed', 'true');

    // Verify filtered card is visible
    await expect(page.locator('[aria-label="Card: Blocker"]')).toBeVisible();

    // Drag "Blocker" card from "Todo" to "In Progress"
    const blockerCard = page.locator('[aria-label="Card: Blocker"]');
    const targetColumn = page.locator('div.w-72').filter({ hasText: 'In Progress' });
    await blockerCard.dragTo(targetColumn);

    // Wait for drag operation to complete
    await page.waitForTimeout(500);

    // Verify card moved to new column
    const inProgressColumn = page.locator('div.w-72').filter({ hasText: 'In Progress' });
    await expect(inProgressColumn.locator('[aria-label="Card: Blocker"]')).toBeVisible();

    // Verify red chip is still selected (filter didn't reset)
    await expect(page.getByLabel('Filter by red cards')).toHaveAttribute('aria-pressed', 'true');
  });
});
