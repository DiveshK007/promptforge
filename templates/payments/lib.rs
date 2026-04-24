use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("{{PROGRAM_ID}}");

pub const MAX_RECIPIENTS: usize = 5;

#[program]
pub mod {{program_name}} {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        recipients: Vec<Pubkey>,
        shares_bps: Vec<u16>,
    ) -> Result<()> {
        require!(recipients.len() >= 2, PaymentError::TooFewRecipients);
        require!(recipients.len() <= MAX_RECIPIENTS, PaymentError::TooManyRecipients);
        require!(recipients.len() == shares_bps.len(), PaymentError::LengthMismatch);

        let total_bps: u32 = shares_bps.iter().map(|&s| s as u32).sum();
        require!(total_bps == 10_000, PaymentError::InvalidShares);

        let splitter = &mut ctx.accounts.splitter;
        splitter.authority = ctx.accounts.authority.key();
        splitter.mint = ctx.accounts.mint.key();
        splitter.recipients = recipients;
        splitter.shares_bps = shares_bps;
        splitter.vault_bump = ctx.bumps.vault;

        msg!("Payment splitter initialized with {} recipients", splitter.recipients.len());
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, PaymentError::ZeroAmount);

        let cpi_accounts = Transfer {
            from: ctx.accounts.depositor_token_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info(),
        };
        token::transfer(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            amount,
        )?;

        msg!("Deposited {} tokens into splitter", amount);
        Ok(())
    }

    pub fn distribute(ctx: Context<Distribute>) -> Result<()> {
        let vault_balance = ctx.accounts.vault.amount;
        require!(vault_balance > 0, PaymentError::EmptyVault);

        let n = ctx.accounts.splitter.recipients.len();
        require!(ctx.remaining_accounts.len() == n, PaymentError::RecipientMismatch);

        for (i, recipient_info) in ctx.remaining_accounts.iter().enumerate() {
            let data = recipient_info.try_borrow_data()?;
            let mut slice: &[u8] = &data;
            let token_account = TokenAccount::try_deserialize(&mut slice)?;
            require!(
                token_account.owner == ctx.accounts.splitter.recipients[i],
                PaymentError::InvalidRecipient
            );
            require!(token_account.mint == ctx.accounts.splitter.mint, PaymentError::InvalidMint);
            require!(recipient_info.is_writable, PaymentError::AccountNotWritable);
        }

        let mut amounts: Vec<u64> = Vec::with_capacity(n);
        let mut allocated: u64 = 0;
        for i in 0..n.saturating_sub(1) {
            let amount = (vault_balance as u128)
                .checked_mul(ctx.accounts.splitter.shares_bps[i] as u128)
                .unwrap()
                .checked_div(10_000u128)
                .unwrap() as u64;
            amounts.push(amount);
            allocated = allocated.saturating_add(amount);
        }
        amounts.push(vault_balance.saturating_sub(allocated));

        let authority_key = ctx.accounts.splitter.authority;
        let mint_key = ctx.accounts.splitter.mint;
        let vault_bump = ctx.accounts.splitter.vault_bump;
        let seeds = &[b"vault".as_ref(), authority_key.as_ref(), mint_key.as_ref(), &[vault_bump]];
        let signer = &[&seeds[..]];

        for (i, recipient_info) in ctx.remaining_accounts.iter().enumerate() {
            if amounts[i] == 0 {
                continue;
            }
            let cpi_accounts = Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: recipient_info.clone(),
                authority: ctx.accounts.vault.to_account_info(),
            };
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    cpi_accounts,
                    signer,
                ),
                amounts[i],
            )?;
        }

        msg!("Distributed {} tokens to {} recipients", vault_balance, n);
        Ok(())
    }
}

#[account]
pub struct PaymentSplitter {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub recipients: Vec<Pubkey>,
    pub shares_bps: Vec<u16>,
    pub vault_bump: u8,
}

impl PaymentSplitter {
    pub const LEN: usize = 8 + 32 + 32 + (4 + 32 * MAX_RECIPIENTS) + (4 + 2 * MAX_RECIPIENTS) + 1;
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = PaymentSplitter::LEN)]
    pub splitter: Account<'info, PaymentSplitter>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub mint: Account<'info, anchor_spl::token::Mint>,
    #[account(
        init,
        payer = authority,
        seeds = [b"vault", authority.key().as_ref(), mint.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = vault,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    pub splitter: Account<'info, PaymentSplitter>,
    /// CHECK: address constraint verifies this matches splitter.authority
    #[account(address = splitter.authority)]
    pub vault_authority: UncheckedAccount<'info>,
    /// CHECK: address constraint verifies this matches splitter.mint
    #[account(address = splitter.mint)]
    pub vault_mint: UncheckedAccount<'info>,
    pub depositor: Signer<'info>,
    #[account(mut)]
    pub depositor_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"vault", vault_authority.key().as_ref(), vault_mint.key().as_ref()],
        bump = splitter.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Distribute<'info> {
    pub splitter: Account<'info, PaymentSplitter>,
    /// CHECK: address constraint verifies this matches splitter.authority
    #[account(address = splitter.authority)]
    pub vault_authority: UncheckedAccount<'info>,
    /// CHECK: address constraint verifies this matches splitter.mint
    #[account(address = splitter.mint)]
    pub vault_mint: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [b"vault", vault_authority.key().as_ref(), vault_mint.key().as_ref()],
        bump = splitter.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum PaymentError {
    #[msg("At least two recipients are required")]
    TooFewRecipients,
    #[msg("Recipient count exceeds maximum of 5")]
    TooManyRecipients,
    #[msg("Recipients and shares arrays must have the same length")]
    LengthMismatch,
    #[msg("Shares must sum to exactly 10000 basis points")]
    InvalidShares,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Vault has no tokens to distribute")]
    EmptyVault,
    #[msg("Number of remaining accounts must match recipient count")]
    RecipientMismatch,
    #[msg("Token account owner does not match expected recipient")]
    InvalidRecipient,
    #[msg("Token account mint does not match splitter mint")]
    InvalidMint,
    #[msg("Recipient token account must be writable")]
    AccountNotWritable,
}
